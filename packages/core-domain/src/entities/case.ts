import { z } from 'zod';
import { SupportReport } from '../support.js';
import { CaseId, SerialId } from '../ids.js';

export const CASE_STATUSES = [
  'open',
  'in_progress',
  'awaiting_customer',
  'resolved',
  'closed',
] as const;
export const CaseStatus = z.enum(CASE_STATUSES);
export type CaseStatus = z.infer<typeof CaseStatus>;
export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'Open',
  in_progress: 'In progress',
  awaiting_customer: 'Awaiting customer',
  resolved: 'Resolved',
  closed: 'Closed',
};
/** Company/site/tenant ownership is resolved from the authorized machine on the server. */
export const CaseCreateInput = z.object({
  serialId: SerialId,
  summary: z.string().trim().min(10).max(4000),
  submissionKey: z.uuid(),
  report: SupportReport,
  attachmentIds: z.array(z.uuid()).max(5).default([]),
  destinationVersion: z.string().min(1),
  confirmed: z.literal(true),
});
export type CaseCreateInput = z.infer<typeof CaseCreateInput>;
export const CaseGetInput = z.object({ caseId: CaseId });
