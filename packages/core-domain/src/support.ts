import { z } from 'zod';
import { SupportSource } from './support-draft.js';

export const SUPPORT_IMPACT_LABEL = {
  unknown: 'Not sure',
  stopped: 'Machine stopped',
  degraded: 'Running with reduced performance',
  intermittent: 'Intermittent problem',
  running: 'Machine running',
} as const;
export const SupportReport = z
  .object({
    sourceReferences: z.array(SupportSource).max(16).optional(),
    preparedFromChat: z.boolean().optional(),
    contactName: z.string().trim().min(1).max(120),
    contactEmail: z.email().max(254),
    contactPhone: z.string().trim().max(60).default(''),
    contactPreference: z.enum(['email', 'phone']).default('email'),
    impact: z
      .enum(['unknown', 'stopped', 'degraded', 'intermittent', 'running'])
      .default('unknown'),
    safetyConcern: z.enum(['unknown', 'yes', 'no']).default('unknown'),
    alarmCode: z.string().trim().max(200).default(''),
    startedAt: z.string().trim().max(200).default(''),
    observations: z.string().trim().max(2000).default(''),
  })
  .refine((value) => value.contactPreference !== 'phone' || value.contactPhone.length > 0, {
    path: ['contactPhone'],
    message: 'Add a phone number or choose email.',
  });
export type SupportReport = z.infer<typeof SupportReport>;
export const MAX_CASE_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CASE_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_CASE_FILES = 5;
export const CASE_FILE_ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,.txt,.log,.csv,.mp4';
export const SupportDestination = z.object({
  id: z.string(),
  label: z.string(),
  channel: z.enum(['inbox', 'email', 'servicemax']),
  version: z.string(),
});
export type SupportDestination = z.infer<typeof SupportDestination>;
