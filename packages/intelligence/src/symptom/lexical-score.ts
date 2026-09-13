/**
 * Deterministic lexical symptom scoring (stage 2, upstream of
 * `normalizeSymptom`). Maps raw operator wording onto the controlled ontology
 * WITHOUT a model — a no-spend, offline scorer that ranks candidates so
 * `normalizeSymptom` can apply the never-over-map rule. A clear keyword win maps;
 * anything ambiguous routes to clarify. An LLM classifier (the `classify` port)
 * can replace this behind the same `SymptomCandidate[]` seam without touching the
 * decision policy.
 *
 * The score is intentionally simple and explainable: it rewards a query that
 * contains a symptom's DISTINCTIVE terms (its path/label nouns, minus generic
 * filler), with prefix matching so "vibrating" can match "vibration". Any distinctive hit
 * floors the score at the match threshold so a single strong keyword can map when
 * it is an unambiguous winner; ties stay below the margin and clarify.
 */

/** Common filler + over-broad domain words that do not discriminate a symptom. */
const GENERIC = new Set([
  'the',
  'a',
  'an',
  'is',
  'are',
  'was',
  'were',
  'my',
  'our',
  'on',
  'in',
  'of',
  'to',
  'it',
  'and',
  'or',
  'for',
  'with',
  'this',
  'that',
  'at',
  'from',
  'since',
  'last',
  'keep',
  'keeps',
  'coming',
  'out',
  'been',
  'has',
  'have',
  'getting',
  'got',
  'see',
  'seeing',
  'looks',
  'look',
  'problem',
  'issue',
  'error',
  'machine',
  'printer',
  'build',
  'builds',
  'part',
  'parts',
  'finished',
  'during',
  'after',
  'before',
  'layer',
  'reading',
  'shows',
  'show',
  'some',
  // Cross-symptom-common powder-bed terms — present in many symptoms, so they do
  // not discriminate one from another (kept out of the distinctive vocabulary).
  'powder',
  'bed',
  'lot',
  'lines',
  'across',
  'chamber',
]);

/** The minimum stem length used for prefix matching ("poros" matches both forms). */
const STEM = 4;

/** The score a single distinctive hit floors at — enough to map when unambiguous. */
export const LEXICAL_HIT_FLOOR = 0.65;

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
    (t) => t.length > 2 && !GENERIC.has(t),
  );
}

/** A symptom's matchable shape — its ontology path + human label + context qualifiers. */
export type ScorableSymptom = {
  readonly path: string;
  readonly label: string;
  readonly contextQualifiers?: readonly string[];
};

/** The distinctive vocabulary of a symptom (path + label + qualifiers, minus filler). */
function distinctiveTerms(symptom: ScorableSymptom): Set<string> {
  const terms = [
    ...symptom.path.split(/[._]/),
    ...tokenize(symptom.label),
    ...(symptom.contextQualifiers ?? []).flatMap((q) => q.split(/[._\s]/)),
  ]
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 2 && !GENERIC.has(t));
  return new Set(terms);
}

function prefixMatch(a: string, b: string): boolean {
  if (a === b) return true;
  const n = Math.min(a.length, b.length, STEM);
  return n >= STEM && a.slice(0, n) === b.slice(0, n);
}

/**
 * Score one symptom against raw wording, in [0, 1]. Returns 0 when no distinctive
 * term is hit; otherwise the fraction of distinctive terms hit, floored at
 * {@link LEXICAL_HIT_FLOOR} so a single strong keyword can win when unambiguous.
 */
export function scoreSymptom(text: string, symptom: ScorableSymptom): number {
  const queryTokens = tokenize(text);
  if (queryTokens.length === 0) return 0;

  const distinctive = distinctiveTerms(symptom);
  if (distinctive.size === 0) return 0;

  let hits = 0;
  for (const term of distinctive) {
    if (queryTokens.some((qt) => prefixMatch(qt, term))) hits += 1;
  }
  if (hits === 0) return 0;

  return Math.max(LEXICAL_HIT_FLOOR, hits / distinctive.size);
}
