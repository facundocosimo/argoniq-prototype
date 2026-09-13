import { documentMachineEligibility, readableDocument } from './eligibility.js';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { type KnowledgeTier, SerialId, roleSpaceOf } from '@argoniq/core-domain';
import { type DocumentRow, documents, serials } from '@argoniq/db';
import { ForbiddenError, NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import {
  type DocumentHealth,
  EMPTY_CHUNK_STATS,
  computeDocumentHealth,
} from './document-health.js';
import { loadChunkStats } from './list-documents.js';

export const PreviewApplicabilityInput = z.object({ serialId: SerialId });
export type PreviewApplicabilityInput = z.infer<typeof PreviewApplicabilityInput>;

/**
 * Which answer channel a document reaches for the customer — the governance annotation
 * that makes the OEM preview a trust surface, not just a filter:
 *  - `customer`   — T1/T2: cited to the customer, and used by the AI.
 *  - `internal`   — T3: the AI may REASON over it, but it is never disclosed/cited.
 *  - `restricted` — T4: credential-isolated; excluded from the AI entirely.
 */
export type ApplicabilityChannel = 'customer' | 'internal' | 'restricted' | 'reference';

export interface ApplicableDocument {
  readonly id: string;
  readonly title: string;
  readonly docKey: string | null;
  readonly revisionLabel: string | null;
  readonly tier: KnowledgeTier;
  readonly sourceType: string;
  readonly category: string;
  readonly scope: string;
  readonly channel: ApplicabilityChannel;
  readonly health: DocumentHealth;
}

export interface SerialApplicability {
  readonly serial: { readonly id: string; readonly serialNumber: string };
  readonly documents: readonly ApplicableDocument[];
}

function channelFor(tier: KnowledgeTier, indexable: boolean): ApplicabilityChannel {
  // Non-indexable artifacts (backups, CAD) are catalogued/downloadable but never read by
  // the AI — regardless of tier — so they resolve as reference-only.
  if (!indexable) return 'reference';
  if (tier === 'T4') return 'restricted';
  if (tier === 'T3') return 'internal';
  return 'customer';
}

/** Human "applies to" altitude, broadest→narrowest (mirrors the catalog + viewer). */
function scopeLabel(d: DocumentRow): string {
  if (d.serialId) return 'This machine';
  if (d.modelId) return 'Model-specific';
  if (d.familyId) return 'Family-wide';
  if (d.companyId) return 'This company';
  return 'All machines';
}

/**
 * Resolve-preview: given a serial, which CURRENT documents apply to it — the OEM's
 * "what would the AI see for this machine?" trust view. The applicability predicate is
 * the document-level mirror of the retrieval eligibility (`chunkEligibility`): a T2 doc
 * must be this serial's own customer (and this-or-any serial), while type-catalog
 * knowledge (T1/T3/T4) applies by family+model or an explicit `document_scopes` target.
 *
 * Unlike retrieval, this returns ALL tiers and annotates each with the channel it reaches
 * (customer / internal / restricted), so the OEM can see the full resolved picture —
 * including the internal T3 and restricted T4 the customer never would. OEM-staff only.
 */
export async function previewSerialApplicability(
  ctx: ServiceContext,
  input: unknown,
): Promise<SerialApplicability> {
  const { serialId } = parseInput(PreviewApplicabilityInput, input);
  if (roleSpaceOf(ctx.actor.role) !== 'oem_staff') {
    throw new ForbiddenError('applicability preview is available to OEM staff only');
  }
  ctx.policy.assertCan('read', 'Document');
  ctx.policy.assertCan('read', 'Serial');

  return ctx.withTenant(async (tx) => {
    const [serial] = await tx
      .select({
        id: serials.id,
        serialNumber: serials.serialNumber,
        companyId: serials.companyId,
        familyId: serials.familyId,
        modelId: serials.modelId,
      })
      .from(serials)
      .where(eq(serials.id, serialId))
      .limit(1);
    if (!serial) throw new NotFoundError('serial', serialId);

    const applies = documentMachineEligibility(ctx.tenantId, serialId);

    const docRows = await tx
      .select()
      .from(documents)
      .where(
        and(eq(documents.tenantId, ctx.tenantId), readableDocument(ctx, { serialId }), applies),
      )
      .orderBy(asc(documents.tier), asc(documents.title));

    const stats = await loadChunkStats(
      tx,
      docRows.map((d) => d.id),
    );

    return {
      serial: { id: serial.id, serialNumber: serial.serialNumber },
      documents: docRows.map((d) => ({
        id: d.id,
        title: d.title,
        docKey: d.docKey,
        revisionLabel: d.revisionLabel,
        tier: d.tier,
        sourceType: d.sourceType,
        category: d.category,
        scope: scopeLabel(d),
        channel: channelFor(d.tier, d.indexable),
        health: computeDocumentHealth(d.status, stats.get(d.id) ?? EMPTY_CHUNK_STATS, d.indexable),
      })),
    };
  });
}
