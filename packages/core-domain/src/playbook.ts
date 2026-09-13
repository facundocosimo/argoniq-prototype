import { z } from 'zod';
import {
  DocumentId,
  MachineFamilyId,
  MachineModelId,
  PartId,
  PlaybookId,
  SymptomId,
  TenantId,
  UserId,
} from './ids.js';
import { SafetyZone, escalateZone } from './safety-zone.js';
import { SafetyContext, classifyZone } from './safety-context.js';

/**
 * A playbook describes candidate causes and diagnostic steps for a machine
 * family and symptom, with optional model scope and document links. The answer
 * pipeline can read stored playbooks. Authoring and approval workflows are not
 * implemented in this prototype.
 */
export const PLAYBOOK_STATUSES = ['draft', 'in_review', 'published', 'deprecated'] as const;
export const PlaybookStatus = z.enum(PLAYBOOK_STATUSES);
export type PlaybookStatus = z.infer<typeof PlaybookStatus>;

/** A candidate cause with a configured prior score. */
export const PlaybookCause = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** Configured prior in [0,1]. */
  priorScore: z.number().min(0).max(1),
  /** Reserved count for future feedback from confirmed case closures. */
  confirmedCount: z.number().int().nonnegative().default(0),
  linkedPartIds: z.array(PartId).default([]),
  notes: z.string().optional(),
});
export type PlaybookCause = z.infer<typeof PlaybookCause>;

export const PLAYBOOK_STEP_KINDS = ['question', 'check', 'action'] as const;
export const PlaybookStepKind = z.enum(PLAYBOOK_STEP_KINDS);
export type PlaybookStepKind = z.infer<typeof PlaybookStepKind>;

export const PlaybookStep = z.object({
  key: z.string().min(1),
  kind: PlaybookStepKind,
  text: z.string().min(1),
  /** Deterministic safety zone for this step. AI may not author YELLOW/RED text. */
  safetyZone: SafetyZone,
  /**
   * The deterministic energy profile used to derive a minimum safety zone.
   * Optional for back-compat; when present, the rule is the FLOOR — `classifyZone`
   * over these flags must not be LESS severe than `safetyZone` (enforced by
   * {@link assertStepZoneConsistent} at publish and the seed guard test). The
   * answer pipeline reads these objective flags, never a model's opinion.
   */
  energy: SafetyContext.optional(),
  /** YELLOW steps require explicit, verified preconditions before they may run. */
  requiresPreconditions: z.boolean().default(false),
  /** Observations that discriminate causes, used by the questioning layer. */
  discriminatesCauseKeys: z.array(z.string()).default([]),
});
export type PlaybookStep = z.infer<typeof PlaybookStep>;

/**
 * The effective zone for a step: the MORE SEVERE of the authored zone and the
 * zone the energy flags derive. With
 * no energy profile, the authored zone stands.
 */
export function effectiveStepZone(step: PlaybookStep): SafetyZone {
  if (!step.energy) return step.safetyZone;
  return escalateZone(step.safetyZone, classifyZone(step.energy));
}

/**
 * Validation helper for callers that publish a playbook. A zone less severe than
 * the energy flags imply is rejected; a more conservative zone is allowed. This
 * is a no-op when there is no energy profile.
 */
export function assertStepZoneConsistent(step: PlaybookStep): void {
  if (!step.energy) return;
  const derived = classifyZone(step.energy);
  if (escalateZone(step.safetyZone, derived) !== step.safetyZone) {
    throw new Error(
      `Playbook step "${step.key}" is authored ${step.safetyZone} but its energy profile derives ${derived} (the deterministic rule is the floor).`,
    );
  }
}

export const Playbook = z.object({
  id: PlaybookId,
  tenantId: TenantId,
  familyId: MachineFamilyId,
  /** Present when this playbook is a model-specific delta. */
  modelId: MachineModelId.optional(),
  symptomId: SymptomId,
  key: z.string().min(1),
  title: z.string().min(1).max(300),
  status: PlaybookStatus.default('draft'),
  version: z.number().int().positive().default(1),
  candidateCauses: z.array(PlaybookCause).default([]),
  steps: z.array(PlaybookStep).default([]),
  linkedDocumentIds: z.array(DocumentId).default([]),
  authoredByUserId: UserId.optional(),
  approvedByUserId: UserId.optional(),
  safetyReviewedByUserId: UserId.optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Playbook = z.infer<typeof Playbook>;
