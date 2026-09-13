import { z } from 'zod';
import { MachineFamilyId, SymptomId, TenantId } from '../ids.js';

/**
 * Symptom ontology  — one controlled scheme.
 *
 * A canonical symptom is a *cause-neutral observation class*, identified by one
 * stable triple: key · path · label. Cause-level distinctions live in the
 * candidate-cause set, never in the symptom id. The ontology is controlled,
 * versioned, and human-curated; below match-confidence, normalization must route
 * to a clarify step (`UNMAPPED`) — never a forced confident map.
 */

/** Sentinel returned by normalization when input cannot be confidently mapped. */
export const UNMAPPED_SYMPTOM = 'UNMAPPED' as const;
export type UnmappedSymptom = typeof UNMAPPED_SYMPTOM;

export const SYMPTOM_STATUSES = ['active', 'deprecated'] as const;
export const SymptomStatus = z.enum(SYMPTOM_STATUSES);
export type SymptomStatus = z.infer<typeof SymptomStatus>;

export const CanonicalSymptom = z.object({
  id: SymptomId,
  tenantId: TenantId,
  familyId: MachineFamilyId,
  /** Stable key, e.g. "SYM-VIBRATION-FRONT-ROLLER". */
  key: z.string().regex(/^SYM-[A-Z0-9-]+$/, 'symptom key must look like SYM-...'),
  /** Dotted observation path, e.g. "motion.vibration.front_roller". */
  path: z.string().regex(/^[a-z0-9_]+(\.[a-z0-9_]+)*$/, 'path must be dotted snake_case'),
  /** Human-readable observation, e.g. "Unusual vibration at the front roller". */
  label: z.string().min(1).max(300),
  /** Optional context qualifiers, e.g. ["post_cleaning", "first_layer"]. */
  contextQualifiers: z.array(z.string()).default([]),
  status: SymptomStatus.default('active'),
  /** Monotonic ontology version for this symptom. */
  version: z.number().int().positive().default(1),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type CanonicalSymptom = z.infer<typeof CanonicalSymptom>;
