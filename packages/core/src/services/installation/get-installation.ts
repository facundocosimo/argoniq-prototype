import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { InstallationDetail, InstallationId } from '@argoniq/core-domain';
import { installations, machineFamilies, machineModels, serials } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const GetInstallationInput = z.object({ installationId: InstallationId });
export type GetInstallationInput = z.infer<typeof GetInstallationInput>;

/**
 * Read one installation (a line/cell) with its ordered stations — the read model
 * the line schematic renders. Authorized under the `Serial` subject: an
 * installation is a grouping of the customer's serials, so its visibility follows
 * the same customer scope (OEM staff see all; a customer sees only its own).
 */
export async function getInstallation(
  ctx: ServiceContext,
  input: unknown,
): Promise<InstallationDetail> {
  const { installationId } = parseInput(GetInstallationInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const data = await ctx.withTenant(async (tx) => {
    const [installation] = await tx
      .select()
      .from(installations)
      .where(eq(installations.id, installationId))
      .limit(1);
    if (!installation) return null;

    const stations = await tx
      .select({
        serialId: serials.id,
        serialNumber: serials.serialNumber,
        position: serials.position,
        manufacturer: serials.manufacturer,
        status: serials.status,
        modelName: machineModels.name,
        familyName: machineFamilies.name,
        iconKey: machineFamilies.iconKey,
      })
      .from(serials)
      .innerJoin(machineModels, eq(machineModels.id, serials.modelId))
      .innerJoin(machineFamilies, eq(machineFamilies.id, serials.familyId))
      .where(eq(serials.installationId, installationId))
      .orderBy(asc(serials.position), asc(serials.serialNumber));

    return { installation, stations };
  });
  if (!data) throw new NotFoundError('installation', installationId);

  // Row-level scope: a customer may only read its own installations.
  ctx.policy.assertCan('read', 'Serial', { companyId: data.installation.companyId });

  const { installation, stations } = data;
  return InstallationDetail.parse({
    installation: {
      id: installation.id,
      tenantId: installation.tenantId,
      companyId: installation.companyId,
      siteId: installation.siteId,
      parentId: installation.parentId,
      kind: installation.kind,
      key: installation.key,
      name: installation.name,
      description: installation.description ?? undefined,
      commissionedAt: installation.commissionedAt ?? undefined,
      warrantyExpiresAt: installation.warrantyExpiresAt ?? undefined,
      status: installation.status,
      createdAt: installation.createdAt,
      updatedAt: installation.updatedAt,
    },
    stations: stations.map((s) => ({
      serialId: s.serialId,
      serialNumber: s.serialNumber,
      position: s.position,
      modelName: s.modelName,
      familyName: s.familyName,
      iconKey: s.iconKey,
      status: s.status,
      manufacturer: s.manufacturer,
    })),
  });
}
