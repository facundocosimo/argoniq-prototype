import { asc, count, eq, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  CompanyId,
  type InstallationKind,
  roleSpaceOf,
  type SerialStatus,
} from '@argoniq/core-domain';
import { installations, serials } from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const ListInstallationsInput = z.object({ companyId: CompanyId.optional() });
export type ListInstallationsInput = z.infer<typeof ListInstallationsInput>;

/** A line/cell in the installed-base list, with its station count. */
export interface InstallationListItem {
  id: string;
  key: string;
  name: string;
  kind: InstallationKind;
  status: SerialStatus;
  stationCount: number;
}

/**
 * List installations (lines/cells) for the installed-base view. Companies are
 * hard-scoped to their own; OEM staff may pass an optional `companyId` filter.
 * Bounded (installations per customer are few); no pagination.
 */
export async function listInstallations(
  ctx: ServiceContext,
  input: unknown,
): Promise<InstallationListItem[]> {
  const { companyId } = parseInput(ListInstallationsInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const isCustomer = roleSpaceOf(ctx.actor.role) === 'customer';
  if (isCustomer && !ctx.actor.companyId) return [];
  const scopedCompanyId = isCustomer ? ctx.actor.companyId : companyId;

  return ctx.withTenant(async (tx) => {
    const where: SQL | undefined = scopedCompanyId
      ? eq(installations.companyId, scopedCompanyId)
      : undefined;

    const rows = await tx
      .select()
      .from(installations)
      .where(where)
      .orderBy(asc(installations.name));

    const counts = await tx
      .select({ installationId: serials.installationId, n: count() })
      .from(serials)
      .groupBy(serials.installationId);
    const countByInstallation = new Map(counts.map((c) => [c.installationId, Number(c.n)]));

    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      kind: r.kind,
      status: r.status,
      stationCount: countByInstallation.get(r.id) ?? 0,
    }));
  });
}
