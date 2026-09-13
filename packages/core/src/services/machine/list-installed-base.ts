import { and, asc, eq, inArray, isNotNull, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import {
  CompanyId,
  type InstallationKind,
  roleSpaceOf,
  type SerialStatus,
} from '@argoniq/core-domain';
import {
  companies,
  installations,
  machineFamilies,
  machineModels,
  serials,
  sites,
  cases,
} from '@argoniq/db';
import { type ServiceContext } from '../../context.js';
import { parseInput } from '../../service.js';

/**
 * The effective status shown on the installed base — a single signal combining the
 * lifecycle STATE with the case-derived HEALTH. Lifecycle wins when the machine is
 * not operating: `decommissioned` (retired), `not_installed` (ordered/awaiting
 * install), `maintenance` (temporarily out). Otherwise health from OPEN service
 * cases : `down` when an open case is RED safety-zone, `disrupted`
 * for any other open case, `operational` when there are none. A line rolls up to
 * its worst station.
 */
export type InstalledBaseStatus =
  'operational' | 'disrupted' | 'down' | 'maintenance' | 'not_installed' | 'decommissioned';

export interface InstalledBaseUnit {
  serialId: string;
  serialNumber: string;
  customerTag: string | null;
  companyName: string | null;
  siteName: string | null;
  /** The machine's name — its model, e.g. "Atlas Training Cell". */
  modelName: string;
  familyName: string;
  iconKey: string | null;
  installedYear: number | null;
  lifecycleStatus: SerialStatus;
  openCases: number;
  status: InstalledBaseStatus;
}

export interface InstalledBaseLine {
  installationId: string;
  name: string;
  kind: InstallationKind;
  installedYear: number | null;
  openCases: number;
  status: InstalledBaseStatus;
  units: InstalledBaseUnit[];
}

export interface InstalledBaseTree {
  lines: InstalledBaseLine[];
  standalone: InstalledBaseUnit[];
}

export const ListInstalledBaseInput = z.object({ companyId: CompanyId.optional() });
export type ListInstalledBaseInput = z.infer<typeof ListInstalledBaseInput>;

/** Open = still needs attention; resolved/closed cases do not affect health. */
const OPEN_STATUSES = ['open', 'in_progress', 'awaiting_customer'] as const;

/** Prominence order for rolling a line up to its worst station. */
const STATUS_RANK: Record<InstalledBaseStatus, number> = {
  decommissioned: 0,
  not_installed: 1,
  operational: 2,
  maintenance: 3,
  disrupted: 4,
  down: 5,
};

/** Lifecycle state wins when the machine is not operating; else health from cases. */
function statusFrom(
  lifecycle: SerialStatus,
  openCases: number,
  hasRed: boolean,
): InstalledBaseStatus {
  if (lifecycle === 'decommissioned') return 'decommissioned';
  if (lifecycle === 'not_installed') return 'not_installed';
  if (lifecycle === 'maintenance') return 'maintenance';
  if (hasRed) return 'down';
  if (openCases > 0) return 'disrupted';
  return 'operational';
}

function yearOf(value: Date | null): number | null {
  return value ? new Date(value).getFullYear() : null;
}

/**
 * The unified installed base — lines (with their ordered stations) and standalone
 * machines, each carrying its year installed and case-derived health. Companies are
 * hard-scoped to their own; OEM staff see the whole tenant. Backs the /machines view.
 */
export async function listInstalledBase(
  ctx: ServiceContext,
  input: unknown,
): Promise<InstalledBaseTree> {
  const { companyId } = parseInput(ListInstalledBaseInput, input);
  ctx.policy.assertCan('read', 'Serial');

  const isCustomer = roleSpaceOf(ctx.actor.role) === 'customer';
  if (isCustomer && !ctx.actor.companyId) return { lines: [], standalone: [] };
  const scopedCompanyId = isCustomer ? ctx.actor.companyId : companyId;

  const data = await ctx.withTenant(async (tx) => {
    const serialScope: SQL | undefined = scopedCompanyId
      ? eq(serials.companyId, scopedCompanyId)
      : undefined;
    const unitRows = await tx
      .select({
        serialId: serials.id,
        serialNumber: serials.serialNumber,
        customerTag: serials.customerTag,
        companyName: companies.name,
        siteName: sites.name,
        installationId: serials.installationId,
        position: serials.position,
        installedAt: serials.installedAt,
        status: serials.status,
        modelName: machineModels.name,
        familyName: machineFamilies.name,
        iconKey: machineFamilies.iconKey,
      })
      .from(serials)
      .innerJoin(machineModels, eq(machineModels.id, serials.modelId))
      .innerJoin(machineFamilies, eq(machineFamilies.id, serials.familyId))
      .leftJoin(companies, eq(companies.id, serials.companyId))
      .leftJoin(sites, eq(sites.id, serials.siteId))
      .where(serialScope)
      .orderBy(asc(serials.position), asc(serials.serialNumber));

    const lineRows = await tx
      .select()
      .from(installations)
      .where(scopedCompanyId ? eq(installations.companyId, scopedCompanyId) : undefined)
      .orderBy(asc(installations.name));

    const caseConds: SQL[] = [inArray(cases.status, [...OPEN_STATUSES]), isNotNull(cases.serialId)];
    if (scopedCompanyId) caseConds.push(eq(cases.companyId, scopedCompanyId));
    const openCases = await tx
      .select({ serialId: cases.serialId, safetyZone: cases.safetyZone })
      .from(cases)
      .where(and(...caseConds));

    return { unitRows, lineRows, openCases };
  });

  // Aggregate open cases per serial.
  const caseAgg = new Map<string, { count: number; hasRed: boolean }>();
  for (const t of data.openCases) {
    if (!t.serialId) continue;
    const cur = caseAgg.get(t.serialId) ?? { count: 0, hasRed: false };
    cur.count += 1;
    if (t.safetyZone === 'RED') cur.hasRed = true;
    caseAgg.set(t.serialId, cur);
  }

  type Row = (typeof data.unitRows)[number];
  const toUnit = (r: Row): InstalledBaseUnit => {
    const agg = caseAgg.get(r.serialId) ?? { count: 0, hasRed: false };
    return {
      serialId: r.serialId,
      serialNumber: r.serialNumber,
      customerTag: r.customerTag,
      companyName: r.companyName,
      siteName: r.siteName,
      modelName: r.modelName,
      familyName: r.familyName,
      iconKey: r.iconKey,
      installedYear: yearOf(r.installedAt),
      lifecycleStatus: r.status,
      openCases: agg.count,
      status: statusFrom(r.status, agg.count, agg.hasRed),
    };
  };

  const unitsByLine = new Map<string, InstalledBaseUnit[]>();
  const standalone: InstalledBaseUnit[] = [];
  for (const row of data.unitRows) {
    const unit = toUnit(row);
    if (row.installationId) {
      const list = unitsByLine.get(row.installationId) ?? [];
      list.push(unit);
      unitsByLine.set(row.installationId, list);
    } else {
      standalone.push(unit);
    }
  }

  const lines: InstalledBaseLine[] = data.lineRows.map((line) => {
    const units = unitsByLine.get(line.id) ?? [];
    const openCases = units.reduce((sum, u) => sum + u.openCases, 0);
    const status = units.reduce<InstalledBaseStatus>(
      (worst, u) => (STATUS_RANK[u.status] > STATUS_RANK[worst] ? u.status : worst),
      'operational',
    );
    return {
      installationId: line.id,
      name: line.name,
      kind: line.kind,
      installedYear: yearOf(line.commissionedAt),
      openCases,
      status,
      units,
    };
  });

  return { lines, standalone };
}
