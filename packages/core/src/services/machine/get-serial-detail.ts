import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { SerialId } from '@argoniq/core-domain';
import { companies, machineFamilies, machineModels, type SerialRow, serials } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

export const GetSerialDetailInput = z.object({ serialId: SerialId });
export type GetSerialDetailInput = z.infer<typeof GetSerialDetailInput>;

/** A serial with the model/family/customer display fields the equipment header needs. */
export interface SerialDetailView {
  serial: SerialRow;
  modelName: string;
  modelImageUrl: string | null;
  familyName: string;
  familyIconKey: string | null;
  /** The owning customer's display name (for OEM-staff context and the machine header). */
  companyName: string;
  /** The line this station belongs to, if any (drives a "part of" link). */
  installationId: string | null;
}

/**
 * Read one serial plus the model/family presentation fields (name, product image,
 * schematic icon). Same authorization as `getSerial` — validate → authorize → act →
 * row-scope. Used by the equipment detail header.
 */
export async function getSerialDetail(
  ctx: ServiceContext,
  input: unknown,
): Promise<SerialDetailView> {
  const { serialId } = parseInput(GetSerialDetailInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const [row] = await ctx.withTenant(async (tx) =>
    tx
      .select({
        serial: serials,
        modelName: machineModels.name,
        modelImageUrl: machineModels.imageUrl,
        familyName: machineFamilies.name,
        familyIconKey: machineFamilies.iconKey,
        companyName: companies.name,
      })
      .from(serials)
      .innerJoin(machineModels, eq(machineModels.id, serials.modelId))
      .innerJoin(machineFamilies, eq(machineFamilies.id, serials.familyId))
      .innerJoin(companies, eq(companies.id, serials.companyId))
      .where(eq(serials.id, serialId))
      .limit(1),
  );
  if (!row) throw new NotFoundError('serial', serialId);

  ctx.policy.assertCan('read', 'Serial', { id: row.serial.id, companyId: row.serial.companyId });

  return {
    serial: row.serial,
    modelName: row.modelName,
    modelImageUrl: row.modelImageUrl,
    familyName: row.familyName,
    familyIconKey: row.familyIconKey,
    companyName: row.companyName,
    installationId: row.serial.installationId,
  };
}
