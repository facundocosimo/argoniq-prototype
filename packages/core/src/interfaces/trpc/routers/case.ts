import { CaseCreateInput, CaseGetInput, SupportDraftInput } from '@argoniq/core-domain';
import {
  prepareCaseDraft,
  retryCaseDelivery,
  ListCasesInput,
  listCases,
  createCase,
  getCase,
  SupportDestinationInput,
  getSupportDestination,
  CaseAttachmentDraftInput,
  CaseAttachmentIdInput,
  listCaseDraftAttachments,
  removeCaseDraftAttachment,
} from '../../../services/case/index.js';
import { protectedProcedure, router } from '../trpc.js';

/**
 * Case router — thin adapter over the case service. `list` returns the
 * customer-facing Pre-qualified Service Case view (redacted of staff-only fields in
 * the service), scoped to the actor by the policy engine.
 */
export const caseRouter = router({
  prepareDraft: protectedProcedure
    .input(SupportDraftInput)
    .mutation(({ ctx, input }) => prepareCaseDraft(ctx.service, input)),
  retryDelivery: protectedProcedure
    .input(CaseGetInput)
    .mutation(({ ctx, input }) => retryCaseDelivery(ctx.service, input)),
  destination: protectedProcedure
    .input(SupportDestinationInput)
    .query(({ ctx, input }) => getSupportDestination(ctx.service, input)),
  draftAttachments: protectedProcedure
    .input(CaseAttachmentDraftInput)
    .query(({ ctx, input }) => listCaseDraftAttachments(ctx.service, input)),
  removeDraftAttachment: protectedProcedure
    .input(CaseAttachmentIdInput)
    .mutation(({ ctx, input }) => removeCaseDraftAttachment(ctx.service, input)),
  create: protectedProcedure
    .input(CaseCreateInput)
    .mutation(({ ctx, input }) => createCase(ctx.service, input)),
  get: protectedProcedure
    .input(CaseGetInput)
    .query(({ ctx, input }) => getCase(ctx.service, input)),
  list: protectedProcedure
    .input(ListCasesInput)
    .query(({ ctx, input }) => listCases(ctx.service, input)),
});
