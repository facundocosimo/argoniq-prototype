import { z } from 'zod';
import { SerialId } from './ids.js';

export const SupportSource = z.object({
  documentId: z.uuid(),
  title: z.string().max(400),
  page: z.number().int().positive().optional(),
});
export const SupportDraftInput = z.object({
  serialId: SerialId,
  history: z
    .array(
      z.object({ role: z.enum(['user', 'assistant']), text: z.string().trim().min(1).max(4000) }),
    )
    .min(1)
    .max(40)
    .refine(
      (h) => h.reduce((sum, t) => sum + t.text.length, 0) <= 24000,
      'Conversation is too long for one report.',
    ),
  sources: z
    .array(SupportSource.pick({ documentId: true, page: true }))
    .max(16)
    .default([]),
});
export type SupportDraftInput = z.infer<typeof SupportDraftInput>;
export const SUPPORT_DRAFT_FIELDS = [
  'contactName',
  'contactEmail',
  'contactPhone',
  'contactPreference',
  'impact',
  'safetyConcern',
  'alarmCode',
  'startedAt',
  'observations',
] as const;
export const SupportDraftExtraction = z.object({
  summary: z.string().trim().min(10).max(4000),
  fields: z
    .array(
      z.object({
        field: z.enum(SUPPORT_DRAFT_FIELDS),
        value: z.string().trim().min(1).max(2000),
        quote: z.string().trim().min(1).max(2000),
      }),
    )
    .max(9),
});
export type SupportDraftExtraction = z.infer<typeof SupportDraftExtraction>;
export const ChatSupportDraft = z.object({
  serialId: SerialId,
  summary: z.string().max(4000),
  fields: z.object({
    contactName: z.string().max(120).optional(),
    contactEmail: z.email().max(254).optional(),
    contactPhone: z.string().max(60).optional(),
    contactPreference: z.enum(['email', 'phone']).optional(),
    impact: z.enum(['unknown', 'stopped', 'degraded', 'intermittent', 'running']).optional(),
    safetyConcern: z.enum(['unknown', 'yes', 'no']).optional(),
    alarmCode: z.string().max(200).optional(),
    startedAt: z.string().max(200).optional(),
    observations: z.string().max(2000).optional(),
  }),
  sources: z.array(SupportSource).max(16),
  preparation: z.enum(['assisted', 'verbatim']),
});
export type ChatSupportDraft = z.infer<typeof ChatSupportDraft>;
