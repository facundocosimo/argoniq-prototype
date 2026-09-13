import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { type EffectiveConfig, SerialId } from '@argoniq/core-domain';
import { serials, variantAxes } from '@argoniq/db';
import { NotFoundError } from '@argoniq/observability';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';
import { buildEffectiveConfig } from './effective-config.js';

export const ResolveEffectiveConfigInput = z.object({ serialId: SerialId });
export type ResolveEffectiveConfigInput = z.infer<typeof ResolveEffectiveConfigInput>;

/** Resolve the selected machine's configuration from its serial record and model axes. */
export async function resolveEffectiveConfig(
  ctx: ServiceContext,
  input: unknown,
): Promise<EffectiveConfig> {
  const { serialId } = parseInput(ResolveEffectiveConfigInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const data = await ctx.withTenant(async (tx) => {
    const [serial] = await tx.select().from(serials).where(eq(serials.id, serialId)).limit(1);
    if (!serial) return null;
    const axes = await tx.select().from(variantAxes).where(eq(variantAxes.modelId, serial.modelId));
    return { serial, axes };
  });
  if (!data) throw new NotFoundError('serial', serialId);

  ctx.policy.assertCan('read', 'Serial', {
    id: data.serial.id,
    companyId: data.serial.companyId,
  });

  const config = buildEffectiveConfig(data.serial, data.axes);
  ctx.logger.info(
    { serialId, attributeCount: config.attributes.length, confidence: config.overallConfidence },
    'effective config resolved',
  );
  return config;
}
