import { documentMachineEligibility, effectiveDocument } from '../document/eligibility.js';
import { type SQL, and, cosineDistance, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import {
  CompanyId,
  DocumentId,
  type EffectiveConfig,
  type KnowledgeTier,
  SerialId,
  type TenantId,
} from '@argoniq/core-domain';
import { type TenantTransaction, documentChunks, documents } from '@argoniq/db';
import { type EmbeddingsPort, type RetrievedSource } from '@argoniq/intelligence';

/**
 * Knowledge retrieval  — assembles the
 * `RetrievedSource[]` the answer pipeline reasons over. It returns two real,
 * tier-correct source kinds, BOTH carrying a `ProvenanceToken` so the output-side
 * isolation gate (gate 3) can verify scope before any citation is delivered:
 *
 *  1. **The serial's EffectiveConfig** — the customer's own as-built data is T2
 *     (customer-specific) and citable to that customer/serial. It is the grounding
 *     spine independent of the document corpus.
 *  2. **Hybrid-retrieved document chunks** — the dense (pgvector cosine) and lexical
 *     (tsvector/BM25) arms over `document_chunks`, fused by Reciprocal Rank Fusion.
 *     Tier and scope are filtered **in SQL** (never fetch-then-drop): T4 is excluded
 *     structurally, T2 is restricted to the requester's customer/serial, and T1/T3
 *     to the serial's family or tenant-wide. T3 is surfaced for the staff channel;
 *     the pipeline's gate 2 removes it from the customer channel.
 *
 * The SQL lives behind the {@link ChunkSearch} port and the embedding behind
 * {@link EmbeddingsPort}, so the orchestration, fusion, and mapping are pure and
 * unit-testable without a database or model spend.
 */

/** Per-arm candidate pool size (vector + lexical each return up to this many). */
export const RETRIEVAL_POOL = 20;
/** Final number of fused chunks handed to the pipeline. */
export const RETRIEVAL_TOP_K = 8;
/** Reciprocal Rank Fusion constant (Cormack et al. 2009 — the standard default). */
export const RRF_K = 60;

export type KnowledgeRetrievalParams = {
  readonly tenantId: TenantId;
  readonly companyId: CompanyId;
  readonly serialId: SerialId;
  readonly serialNumber: string;
  readonly familyId: string;
  /** The serial's resolved model — narrows model-specific docs (null = model-agnostic query). */
  readonly modelId: string | null;
  readonly config: EffectiveConfig;
  /** The operator's wording — the dense + lexical query for chunk retrieval. */
  readonly queryText: string;
};

export type RetrievalDeps = {
  readonly embeddings: EmbeddingsPort;
  readonly search: ChunkSearch;
  /** Offline previews use lexical search; hybrid requires compatible dense vectors. */
  readonly retrievalMode?: 'hybrid' | 'lexical';
};

/** One retrieved chunk, with its document's scope columns (for provenance + filtering). */
export type ChunkHit = {
  readonly chunkId: string;
  readonly documentId: string;
  readonly tier: KnowledgeTier;
  readonly content: string;
  readonly page: number | null;
  readonly companyId: string | null;
  readonly serialId: string | null;
  /** Per-chunk hard block from any customer-facing channel. */
  readonly forbiddenForCustomerFacing: boolean;
  /** Provenance for a deep-linkable citation ("Training Reference, p.4"). */
  readonly documentTitle: string;
  readonly sectionPath: string | null;
  readonly sectionTitle: string | null;
};

export type ChunkSearchParams = {
  readonly tenantId: TenantId;
  readonly companyId: CompanyId;
  readonly serialId: SerialId;
  readonly familyId: string;
  readonly modelId: string | null;
  readonly queryText: string;
  readonly queryVector: readonly number[];
  /** Dense queries compare only vectors produced by this provider-qualified model. */
  readonly embeddingModel?: string;
  readonly limit: number;
};

/**
 * The chunk-search seam — the two hybrid arms, each tier-filtered + scoped IN SQL.
 * A consumer depends on this interface (not Drizzle), so retrieval orchestration is
 * unit-tested with a fake; the Drizzle implementation runs inside the caller's
 * tenant-scoped transaction (RLS active).
 */
export interface ChunkSearch {
  vectorSearch(tx: TenantTransaction, params: ChunkSearchParams): Promise<ChunkHit[]>;
  lexicalSearch(tx: TenantTransaction, params: ChunkSearchParams): Promise<ChunkHit[]>;
}

// --- The serial's EffectiveConfig as a T2 source ----------------------------

function configSource(params: KnowledgeRetrievalParams): RetrievedSource {
  const summary = params.config.attributes
    .map((attribute) => `${attribute.label}: ${String(attribute.value)}`)
    .join('; ');
  return {
    ref: `config:${params.serialNumber}`,
    tier: 'T2',
    text: `As-built configuration for serial ${params.serialNumber} — ${summary}.`,
    forbiddenForCustomerFacing: false,
    provenance: {
      tenantId: params.tenantId,
      tier: 'T2',
      companyId: params.companyId,
      serialId: params.serialId,
    },
  };
}

// --- Hybrid chunk search (Drizzle) ------------------------------------------

/** The columns every arm selects — chunk text/provenance + the document's scope. */
const CHUNK_COLUMNS = {
  chunkId: documentChunks.id,
  documentId: documentChunks.documentId,
  tier: documentChunks.tier,
  content: documentChunks.content,
  page: documentChunks.page,
  companyId: documents.companyId,
  serialId: documents.serialId,
  forbiddenForCustomerFacing: documentChunks.forbiddenForCustomerFacing,
  documentTitle: documents.title,
  sectionPath: documentChunks.sectionPath,
  sectionTitle: documentChunks.sectionTitle,
} as const;

/**
 * The eligibility predicate, applied to BOTH arms in SQL (no fetch-then-drop):
 *  - T4 is excluded structurally (credential-isolated);
 *  - only the **current** revision of a document is retrievable — superseded
 *    revisions are retained for history but never pollute an answer;
 *  - T2 (customer-specific) must match the requester's customer and either this
 *    serial or the customer's whole fleet (`serial_id IS NULL`);
 *  - T1/T3 (not customer-scoped) are eligible by *applicability*: the primary
 *    scope must match — family agnostic-or-equal AND model agnostic-or-equal — so
 *    a tenant-wide doc (both null), a family-wide doc (family set, model null, e.g.
 *    a family-wide safety guide), and a model-specific document (both set, e.g. an Atlas
 *    model reference) each match correctly, while a *sibling model's* document is
 *    excluded (family matches but model does not). Additional family/model targets
 *    declared in `document_scopes` are ORed in for one-file-many-models flexibility.
 * A foreign customer's T2 and a sibling serial's T2 both fail every branch, so they
 * can never enter the candidate set.
 */
export function chunkEligibility(params: ChunkSearchParams): SQL | undefined {
  return and(
    ne(documentChunks.tier, 'T4'),
    eq(documentChunks.tenantId, params.tenantId),
    eq(documents.tenantId, params.tenantId),
    effectiveDocument(),
    eq(documents.status, 'ingested'),
    eq(documents.indexable, true),
    eq(documentChunks.aiMayCite, true),
    documentMachineEligibility(params.tenantId, params.serialId, params.companyId),
  );
}

/**
 * Turn free-text into an OR `tsquery` string (`a | b | c`) of its content tokens.
 * Tokens are sanitized to `[a-z0-9]{2,}` so the result is always valid tsquery syntax
 * (no injection, no parser errors); Postgres's `english` config then stems and drops
 * stopwords. Empty when the text has no usable tokens.
 */
export function toOrTsQuery(text: string): string {
  const tokens = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  return [...new Set(tokens)].join(' | ');
}

export class DrizzleChunkSearch implements ChunkSearch {
  async vectorSearch(tx: TenantTransaction, params: ChunkSearchParams): Promise<ChunkHit[]> {
    if (!params.embeddingModel)
      throw new Error('Dense retrieval requires an embedding model identity');
    return (
      tx
        .select(CHUNK_COLUMNS)
        .from(documentChunks)
        .innerJoin(documents, eq(documents.id, documentChunks.documentId))
        .where(
          and(
            chunkEligibility(params),
            isNotNull(documentChunks.embedding),
            eq(documentChunks.embeddingModel, params.embeddingModel),
          ),
        )
        // pgvector cosine distance (smaller = closer); uses the HNSW index.
        .orderBy(cosineDistance(documentChunks.embedding, [...params.queryVector]))
        .limit(params.limit)
    );
  }

  async lexicalSearch(tx: TenantTransaction, params: ChunkSearchParams): Promise<ChunkHit[]> {
    // `plainto_tsquery` ANDs every word, so a verbose natural-language question
    // ("...instead of argon? I have no more argon in stock") matches no chunk. Build an
    // OR query over the content terms instead (the `english` config drops stopwords), and
    // let `ts_rank_cd` float the chunks that match the most/strongest terms. This keeps
    // BM25 useful for questions on its own; the dense arm still adds true semantic recall.
    const orQuery = toOrTsQuery(params.queryText);
    if (orQuery.length === 0) return [];
    // The tsvector MUST match the GIN index in applySearchIndexes so `@@` is accelerated.
    const tsvector = sql`to_tsvector('english', ${documentChunks.content})`;
    const tsquery = sql`to_tsquery('english', ${orQuery})`;
    return tx
      .select(CHUNK_COLUMNS)
      .from(documentChunks)
      .innerJoin(documents, eq(documents.id, documentChunks.documentId))
      .where(and(chunkEligibility(params), sql`${tsvector} @@ ${tsquery}`))
      .orderBy(desc(sql`ts_rank_cd(${tsvector}, ${tsquery})`))
      .limit(params.limit);
  }
}

// --- Pure fusion + mapping --------------------------------------------------

/**
 * Reciprocal Rank Fusion of one or more ranked arms into a single best-first list.
 * Each arm contributes `1 / (RRF_K + rank)` (1-based rank), so a chunk surfaced by
 * A result found by both dense and lexical search outranks one found by only one,
 * needing to normalize the arms' incomparable score scales. Deterministic.
 */
export function fuseByRrf(arms: readonly (readonly ChunkHit[])[], topK: number): ChunkHit[] {
  const scores = new Map<string, number>();
  const byId = new Map<string, ChunkHit>();
  for (const arm of arms) {
    arm.forEach((hit, index) => {
      byId.set(hit.chunkId, hit);
      scores.set(hit.chunkId, (scores.get(hit.chunkId) ?? 0) + 1 / (RRF_K + index + 1));
    });
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topK)
    .map(([chunkId]) => byId.get(chunkId)!);
}

/** Map a chunk hit to a `RetrievedSource`, carrying the provenance gate 3 verifies. */
function chunkToSource(hit: ChunkHit, tenantId: TenantId): RetrievedSource {
  return {
    ref: `chunk:${hit.chunkId}`,
    tier: hit.tier,
    text: hit.content,
    // Per-chunk customer-facing governance (hazard paragraphs), layered on top
    // of tier-by-channel exclusion (gate 2) as defense in depth.
    forbiddenForCustomerFacing: hit.forbiddenForCustomerFacing,
    documentTitle: hit.documentTitle,
    ...(hit.sectionPath ? { sectionPath: hit.sectionPath } : {}),
    ...(hit.sectionTitle ? { sectionTitle: hit.sectionTitle } : {}),
    provenance: {
      tenantId,
      tier: hit.tier,
      documentId: DocumentId.parse(hit.documentId),
      ...(hit.companyId ? { companyId: CompanyId.parse(hit.companyId) } : {}),
      ...(hit.serialId ? { serialId: SerialId.parse(hit.serialId) } : {}),
      ...(hit.page ? { page: hit.page } : {}),
    },
  };
}

// --- Orchestration ----------------------------------------------------------

/**
 * Build the knowledge sources for one answer turn. Runs inside the caller's
 * tenant-scoped transaction (RLS active), so every read is tenant-isolated. Returns
 * the config source first, then the fused, tier-/scope-filtered chunk sources.
 */
export async function buildKnowledgeSources(
  tx: TenantTransaction,
  params: KnowledgeRetrievalParams,
  deps: RetrievalDeps,
): Promise<RetrievedSource[]> {
  const sources: RetrievedSource[] = [configSource(params)];

  const queryText = params.queryText.trim();
  if (queryText.length === 0) return sources;

  const useDense = deps.retrievalMode !== 'lexical';
  const embedding = useDense
    ? await deps.embeddings.embed({ inputs: [queryText], inputType: 'query' })
    : undefined;
  const searchParams: ChunkSearchParams = {
    tenantId: params.tenantId,
    companyId: params.companyId,
    serialId: params.serialId,
    familyId: params.familyId,
    modelId: params.modelId,
    queryText,
    queryVector: embedding?.vectors[0] ?? [],
    ...(embedding ? { embeddingModel: embedding.model } : {}),
    limit: RETRIEVAL_POOL,
  };

  // Sequential (not concurrent): both arms share the one tenant-scoped tx connection.
  const dense = useDense ? await deps.search.vectorSearch(tx, searchParams) : [];
  const lexical = await deps.search.lexicalSearch(tx, searchParams);
  for (const hit of fuseByRrf([dense, lexical], RETRIEVAL_TOP_K)) {
    sources.push(chunkToSource(hit, params.tenantId));
  }

  return sources;
}
