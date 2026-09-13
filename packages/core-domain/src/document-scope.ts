import { z } from 'zod';
import { CompanyId, InstallationId, MachineFamilyId, MachineModelId, SerialId } from './ids.js';
import { KnowledgeTier } from './knowledge-tier.js';

/** Audience ownership is distinct from catalog applicability. Referenced records
 * must additionally be resolved in the current tenant before persistence. */
export const DocumentScope = z
  .object({
    tier: KnowledgeTier,
    familyId: MachineFamilyId.nullish(),
    modelId: MachineModelId.nullish(),
    companyId: CompanyId.nullish(),
    serialId: SerialId.nullish(),
    installationId: InstallationId.nullish(),
  })
  .superRefine((scope, ctx) => {
    if (scope.tier === 'T2' && !scope.companyId) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyId'],
        message: 'Company-specific documents require a company.',
      });
    }
    if (scope.tier === 'T1' || scope.tier === 'T3') {
      for (const field of ['companyId', 'serialId', 'installationId'] as const) {
        if (scope[field])
          ctx.addIssue({
            code: 'custom',
            path: [field],
            message:
              'Catalog documents cannot carry company, machine or installation ownership. Use company-specific audience for customer records.',
          });
      }
    }
    if ((scope.serialId || scope.installationId) && !scope.companyId) {
      ctx.addIssue({
        code: 'custom',
        path: ['companyId'],
        message: 'A machine or installation scope requires its owning company.',
      });
    }
  });

export type DocumentScope = z.infer<typeof DocumentScope>;
