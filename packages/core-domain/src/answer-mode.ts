import { z } from 'zod';

/**
 * The six answer modes. Every AI response resolves to
 * exactly one mode. Modes A/B are the only ones eligible for customer auto-send;
 * D is staff-facing; E/F never proceed to a customer-facing technical claim.
 *
 *  - A  Direct, cited        — grounded answer with T1/T2 citations.
 *  - B  Guided check         — a safe, low-energy step for the customer to perform.
 *  - C  Recommendation       — ranked cause(s) with confidence; NOT customer auto-send.
 *  - D  Internal note        — staff-facing reasoning (may reflect T3); never shown to customer.
 *  - E  Escalation           — structured case / human handoff.
 *  - F  Refusal              — declines unsafe or ungroundable requests.
 */
export const ANSWER_MODES = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

export const AnswerMode = z.enum(ANSWER_MODES);
export type AnswerMode = z.infer<typeof AnswerMode>;

/** Modes that may be delivered directly to a customer without human review. */
const CUSTOMER_AUTOSEND_MODES = new Set<AnswerMode>(['A', 'B']);

/** Modes whose body is staff-facing only and must never reach a customer. */
const STAFF_ONLY_MODES = new Set<AnswerMode>(['D']);

export function isCustomerAutoSendEligible(mode: AnswerMode): boolean {
  return CUSTOMER_AUTOSEND_MODES.has(mode);
}

export function isStaffOnly(mode: AnswerMode): boolean {
  return STAFF_ONLY_MODES.has(mode);
}

export const ANSWER_MODE_LABELS: Record<AnswerMode, string> = {
  A: 'Direct answer',
  B: 'Guided check',
  C: 'Recommendation',
  D: 'Internal note',
  E: 'Escalation',
  F: 'Declined',
};
