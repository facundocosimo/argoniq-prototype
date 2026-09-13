import { z } from 'zod';

/**
 * Contact roles — the FUNCTION a person serves at a customer (CRM), independent of
 * their exact job title (which is free-text on the contact). A small controlled
 * vocabulary so the UI can render a typographic status and filter by function. The DB
 * `contact_role` enum mirrors this list — keep the two in sync.
 */
export const CONTACT_ROLES = [
  'maintenance',
  'operations',
  'engineering',
  'management',
  'procurement',
  'quality',
  'other',
] as const;

export const ContactRole = z.enum(CONTACT_ROLES);
export type ContactRole = z.infer<typeof ContactRole>;

/** Human labels for the UI (registry column, role picker). Presentation only. */
export const CONTACT_ROLE_LABELS: Record<ContactRole, string> = {
  maintenance: 'Maintenance',
  operations: 'Operations',
  engineering: 'Engineering',
  management: 'Management',
  procurement: 'Procurement',
  quality: 'Quality & safety',
  other: 'Other',
};

export function contactRoleLabel(role: string): string {
  return CONTACT_ROLE_LABELS[role as ContactRole] ?? 'Other';
}
