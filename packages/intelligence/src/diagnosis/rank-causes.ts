import { z } from 'zod';
import { type ConfidenceScore } from '@argoniq/core-domain';

/**
 * Rank candidate causes from authored priors and observed evidence.
 *
 * A weighted-evidence / Bayesian-style update: start from each cause's prior,
 * multiply by likelihood factors as evidence arrives, renormalize. Stated
 * honestly : the factors are *human-assigned playbook weights*, not learned
 * calibrated probabilities. The output is an ordering with internal numeric
 * posteriors — never shown to a customer as a decimal.
 *
 * The  anti-overconfidence guards are encoded here, not left to the caller:
 *  - **Per-factor cap**: no single evidence factor may multiply a cause by more
 *    than `MAX_FACTOR` or less than `MIN_FACTOR`. One soft answer can't swing
 *    belief far enough to manufacture a false High.
 *  - **Posterior floor**: a non-eliminated cause never drops below `POSTERIOR_FLOOR`
 *    on soft evidence alone; only a definitive observation may eliminate it.
 */

/** Max multiplier any single evidence factor may apply ("no more than ~3×"). */
export const MAX_FACTOR = 3;
/** Min multiplier any single evidence factor may apply ("no factor below ~0.3×"). */
export const MIN_FACTOR = 0.3;
/** Floor on a non-eliminated posterior before renormalization ("~2–3%"). */
export const POSTERIOR_FLOOR = 0.02;

/** A candidate cause with its starting prior (from playbook base rate × fleet × config). */
export const CauseCandidate = z.object({
  /** Stable cause key from the playbook (e.g. "nozzle-dripping"). */
  key: z.string().min(1),
  /** Starting prior score in [0,1] (need not be normalized; ranking renormalizes). */
  prior: z.number().min(0).max(1),
  /**
   * Whether a definitive observation has eliminated this cause. Eliminated causes
   * get zero posterior and bypass the floor — only a hard observation may do this.
   */
  eliminated: z.boolean().default(false),
});
export type CauseCandidate = z.infer<typeof CauseCandidate>;

/** One evidence factor applied to one cause key (a playbook likelihood weight). */
export const EvidenceFactor = z.object({
  causeKey: z.string().min(1),
  /** Raw multiplier; clamped to [MIN_FACTOR, MAX_FACTOR] before application. */
  factor: z.number().positive(),
});
export type EvidenceFactor = z.infer<typeof EvidenceFactor>;

export const RankCausesInput = z.object({
  candidates: z.array(CauseCandidate).min(1),
  /** Soft-evidence factors gathered so far; multiple per cause are multiplied. */
  evidence: z.array(EvidenceFactor).default([]),
});
export type RankCausesInput = z.infer<typeof RankCausesInput>;

/** A ranked cause with its normalized posterior (internal numeric, staff-facing only). */
export type RankedCause = {
  readonly key: string;
  readonly posterior: ConfidenceScore;
  readonly eliminated: boolean;
};

/** Best-first ranked posteriors plus the derived top / margin used by the gate. */
export type RankedPosteriors = {
  readonly ranked: readonly RankedCause[];
  /** Top posterior, or 0 when every cause is eliminated. */
  readonly topScore: ConfidenceScore;
  /** Top-1 minus top-2 posterior (0 when fewer than two non-zero causes). */
  readonly margin: number;
};

function clampFactor(factor: number): number {
  if (factor > MAX_FACTOR) return MAX_FACTOR;
  if (factor < MIN_FACTOR) return MIN_FACTOR;
  return factor;
}

/**
 * Rank candidate causes into normalized posteriors, applying per-factor caps and
 * the non-elimination floor. Pure and deterministic.
 */
export function rankCauses(input: RankCausesInput): RankedPosteriors {
  const { candidates, evidence } = RankCausesInput.parse(input);

  const factorsByCause = new Map<string, number[]>();
  for (const { causeKey, factor } of evidence) {
    const list = factorsByCause.get(causeKey) ?? [];
    list.push(clampFactor(factor));
    factorsByCause.set(causeKey, list);
  }

  // Raw (unnormalized) score per cause: prior × clamped factors, floored unless eliminated.
  const raw = candidates.map((c) => {
    if (c.eliminated) return { key: c.key, score: 0, eliminated: true };
    const factors = factorsByCause.get(c.key) ?? [];
    const product = factors.reduce((acc, f) => acc * f, c.prior);
    const score = Math.max(product, POSTERIOR_FLOOR);
    return { key: c.key, score, eliminated: false };
  });

  const total = raw.reduce((acc, r) => acc + r.score, 0);
  const ranked: RankedCause[] = raw
    .map((r) => ({
      key: r.key,
      posterior: total > 0 ? r.score / total : 0,
      eliminated: r.eliminated,
    }))
    .sort((a, b) => b.posterior - a.posterior);

  const topScore = ranked[0]?.posterior ?? 0;
  const secondScore = ranked[1]?.posterior ?? 0;
  const margin = topScore - secondScore;

  return { ranked, topScore, margin };
}
