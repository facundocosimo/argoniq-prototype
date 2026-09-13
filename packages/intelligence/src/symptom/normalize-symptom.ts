import { z } from 'zod';
import {
  type CanonicalSymptom,
  type ConfidenceScore,
  UNMAPPED_SYMPTOM,
} from '@argoniq/core-domain';

/**
 * Map free-text symptoms to the controlled ontology.
 *
 * Map raw shop-floor wording onto the controlled, versioned symptom ontology.
 * This is a *classification* problem (text → one or more ontology nodes), NOT
 * free generation. The defensible rule: **below match-confidence, never force a
 * confident wrong map** — route to `UNMAPPED` so the pipeline asks a clarifying
 * question instead of hallucinating a diagnosis ( garbage-input guard).
 *
 * The pure function here is the *decision policy* over scored candidates. The
 * lexical/embedding/LLM scoring that produces those candidates is upstream (the
 * LLM step goes through `intelligence/llm`); keeping the decision pure makes it
 * unit-testable and keeps the "never over-map" invariant deterministic.
 */

/** Minimum top-1 score to accept a confident single map ( over-mapping guard). */
export const SYMPTOM_MATCH_FLOOR = 0.6;

/**
 * Minimum top-1 vs top-2 score margin. Below this the input is genuinely
 * ambiguous (a multi-map), so we do NOT collapse to the nearest node
 * ( "thin-margin guard", MVP rule ≈ 0.05).
 */
export const SYMPTOM_MARGIN_FLOOR = 0.05;

/** A scored candidate match against one ontology node, from upstream scoring. */
export const SymptomCandidate = z.object({
  symptom: z.custom<CanonicalSymptom>(),
  /** Match score in [0,1] for this node (lexical/embedding/LLM blended upstream). */
  score: z.number().min(0).max(1),
});
export type SymptomCandidate = z.infer<typeof SymptomCandidate>;

/** Input to the normalizer: the candidate set scored against the ontology. */
export const NormalizeSymptomInput = z.object({
  /** Candidate ontology matches, in any order. */
  candidates: z.array(SymptomCandidate),
  /** Optional per-call overrides; the FLOORs default to the  MVP values. */
  matchFloor: z.number().min(0).max(1).default(SYMPTOM_MATCH_FLOOR),
  marginFloor: z.number().min(0).max(1).default(SYMPTOM_MARGIN_FLOOR),
});
export type NormalizeSymptomInput = z.infer<typeof NormalizeSymptomInput>;

/** A confident single mapping to one ontology node. */
export type MappedSymptom = {
  readonly kind: 'mapped';
  readonly symptom: CanonicalSymptom;
  readonly confidence: ConfidenceScore;
};

/**
 * No confident map. Either nothing scored above the floor, or the top two were
 * within the margin (ambiguous). The pipeline must clarify, never diagnose.
 * Carries the low-confidence candidates so the clarify step can offer choices.
 */
export type UnmappedSymptomResult = {
  readonly kind: 'unmapped';
  readonly reason: 'no_candidate' | 'below_floor' | 'ambiguous';
  /** The symptom sentinel — re-exported for callers that branch on it. */
  readonly symptom: typeof UNMAPPED_SYMPTOM;
  /** Candidates that were considered, best-first, for a clarify prompt. */
  readonly candidates: readonly SymptomCandidate[];
};

export type NormalizeSymptomResult = MappedSymptom | UnmappedSymptomResult;

/**
 * Decide the normalized symptom from scored candidates, applying the
 * never-over-map rule deterministically.
 *
 * - No candidates at all → UNMAPPED (`no_candidate`).
 * - Top-1 below `matchFloor` → UNMAPPED (`below_floor`).
 * - Top-1 within `marginFloor` of top-2 → UNMAPPED (`ambiguous`, multi-map).
 * - Otherwise → a single confident MappedSymptom.
 */
export function normalizeSymptom(
  input: z.input<typeof NormalizeSymptomInput>,
): NormalizeSymptomResult {
  const { candidates, matchFloor, marginFloor } = NormalizeSymptomInput.parse(input);

  if (candidates.length === 0) {
    return {
      kind: 'unmapped',
      reason: 'no_candidate',
      symptom: UNMAPPED_SYMPTOM,
      candidates: [],
    };
  }

  const ranked = [...candidates].sort((a, b) => b.score - a.score);
  // `ranked` is non-empty (guarded above); index 0 is defined.
  const top = ranked[0]!;

  if (top.score < matchFloor) {
    return {
      kind: 'unmapped',
      reason: 'below_floor',
      symptom: UNMAPPED_SYMPTOM,
      candidates: ranked,
    };
  }

  const second = ranked[1];
  if (second && top.score - second.score < marginFloor) {
    return {
      kind: 'unmapped',
      reason: 'ambiguous',
      symptom: UNMAPPED_SYMPTOM,
      candidates: ranked,
    };
  }

  return { kind: 'mapped', symptom: top.symptom, confidence: top.score };
}
