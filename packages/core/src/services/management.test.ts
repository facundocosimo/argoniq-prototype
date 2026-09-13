import { describe, expect, it } from 'vitest';
import { type Actor, createPolicyEngine } from '@argoniq/auth';
import {
  type AuditEvent,
  type Auditor,
  ConflictError,
  ForbiddenError,
  type Logger,
  NotFoundError,
  ValidationError,
  noopAuditor,
} from '@argoniq/observability';
import {
  companies,
  machineFamilies,
  machineModels,
  serials,
  sites,
  variantAxes,
} from '@argoniq/db';
import { type ServiceContext } from '../context.js';
import { createCompany, deleteCompany, updateCompany } from './company/index.js';
import { createSite } from './site/index.js';
import { createSerial } from './machine/index.js';
import {
  createMachineFamily,
  createMachineModel,
  createVariantAxis,
  deleteMachineFamily,
  listMachineFamilies,
} from './catalog/index.js';

/**
 * Service-level tests for the OEM management (write) surface. They exercise the
 * real services — real policy engine, real validation, real audit — over a stubbed
 * tenant transaction (canned rows, no Postgres). Each write is verified for the two
 * properties that matter: it performs and audits the mutation for an authorized
 * OEM actor, and it is denied for a customer actor (the policy engine, not the
 * transport, is the gate). Cross-parent integrity + option-value validation are
 * covered on the serial path.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const USER = '99999999-9999-4999-8999-999999999999';
const CUSTOMER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_CUSTOMER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const SITE = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const FAMILY = '72b242a8-48b1-5693-a4fb-e21377d7dfc5';
const MODEL = 'f0930ce7-9543-52f7-9c3e-4f94934b28c8';
const NEW_ID = 'eeeeeeee-1111-4111-8111-111111111111';

const adminActor: Actor = {
  userId: USER as Actor['userId'],
  tenantId: TENANT as Actor['tenantId'],
  role: 'admin',
};
const customerActor: Actor = {
  userId: USER as Actor['userId'],
  tenantId: TENANT as Actor['tenantId'],
  role: 'operator',
  companyId: CUSTOMER as NonNullable<Actor['companyId']>,
};
// An OEM staffer WITHOUT `manage all` — may read the catalog (form pickers) but never author it.
const techActor: Actor = {
  userId: USER as Actor['userId'],
  tenantId: TENANT as Actor['tenantId'],
  role: 'support_technician',
};

/** A thenable drizzle-query stub: any chain resolves to the canned rows for a table. */
function queryStub(rows: unknown[]): unknown {
  const builder: Record<string, unknown> = {
    from: () => builder,
    where: () => builder,
    limit: () => builder,
    orderBy: () => builder,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  };
  return builder;
}

type Harness = { events: AuditEvent[]; ctx: ServiceContext };

function makeContext(actor: Actor, canned: Map<unknown, unknown[]>, writeRow: unknown): Harness {
  const events: AuditEvent[] = [];
  const tx = {
    execute: () => Promise.resolve(undefined),
    select: () => ({ from: (table: unknown) => queryStub(canned.get(table) ?? []) }),
    insert: () => ({ values: () => ({ returning: () => Promise.resolve([writeRow]) }) }),
    update: () => ({
      set: () => ({ where: () => ({ returning: () => Promise.resolve([writeRow]) }) }),
    }),
    delete: () => ({ where: () => Promise.resolve(undefined) }),
  };
  const logger = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
    child: () => logger,
  } as unknown as Logger;
  const auditor: Auditor = { record: (event) => events.push(event) };

  const ctx: ServiceContext = {
    actor,
    tenantId: actor.tenantId,
    db: {} as ServiceContext['db'],
    policy: createPolicyEngine(actor, noopAuditor),
    auditor,
    logger,
    withTenant: (<T>(fn: (t: unknown) => Promise<T>) => fn(tx)) as ServiceContext['withTenant'],
  };
  return { events, ctx };
}

const companyRow = { id: CUSTOMER, tenantId: TENANT, name: 'Acme' };
const siteRow = { id: SITE, tenantId: TENANT, companyId: CUSTOMER, name: 'Turin plant' };
const familyRow = { id: FAMILY, tenantId: TENANT };
const modelRow = { id: MODEL, tenantId: TENANT, familyId: FAMILY };
const axisRows = [
  { key: 'profile', label: 'Training profile', dataType: 'enum', options: ['LAB-A', 'LAB-B'] },
];

/** Canned rows covering every parent a serial create/lookup reads. */
function fullCanned(): Map<unknown, unknown[]> {
  return new Map<unknown, unknown[]>([
    [companies, [companyRow]],
    [sites, [siteRow]],
    [machineFamilies, [familyRow]],
    [machineModels, [modelRow]],
    [variantAxes, axisRows],
    [serials, []],
  ]);
}

describe('customer writes', () => {
  it('creates a customer for an OEM admin and audits the mutation', async () => {
    const { ctx, events } = makeContext(adminActor, new Map(), { ...companyRow, id: NEW_ID });
    const row = await createCompany(ctx, { name: 'Acme Additive' });

    expect(row.id).toBe(NEW_ID);
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'access', action: 'company.created', subjectId: NEW_ID }),
    );
  });

  it('denies a customer actor from creating a customer', async () => {
    const { ctx } = makeContext(customerActor, new Map(), companyRow);
    await expect(createCompany(ctx, { name: 'X' })).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects an empty name at the validation edge', async () => {
    const { ctx } = makeContext(adminActor, new Map(), companyRow);
    await expect(createCompany(ctx, { name: '' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('404s when updating a customer that does not exist in scope', async () => {
    const { ctx } = makeContext(adminActor, new Map([[companies, []]]), companyRow);
    await expect(updateCompany(ctx, { id: CUSTOMER, name: 'X' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('deletes a customer for an OEM admin and audits it', async () => {
    const { ctx, events } = makeContext(
      adminActor,
      new Map([[companies, [companyRow]]]),
      companyRow,
    );
    const result = await deleteCompany(ctx, { id: CUSTOMER });

    expect(result.id).toBe(CUSTOMER);
    expect(events).toContainEqual(
      expect.objectContaining({ kind: 'access', action: 'company.deleted' }),
    );
  });
});

describe('site writes', () => {
  it('creates a site under an existing customer for an OEM admin', async () => {
    const canned = new Map<unknown, unknown[]>([[companies, [companyRow]]]);
    const { ctx, events } = makeContext(adminActor, canned, { ...siteRow, id: NEW_ID });
    const row = await createSite(ctx, {
      companyId: CUSTOMER,
      name: 'Turin plant',
      countryCode: 'IT',
    });

    expect(row.id).toBe(NEW_ID);
    expect(events).toContainEqual(expect.objectContaining({ action: 'site.created' }));
  });

  it('404s when the parent customer is not in scope', async () => {
    const { ctx } = makeContext(adminActor, new Map([[companies, []]]), siteRow);
    await expect(createSite(ctx, { companyId: CUSTOMER, name: 'X' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('denies a customer actor from creating a site', async () => {
    const { ctx } = makeContext(customerActor, new Map([[companies, [companyRow]]]), siteRow);
    await expect(createSite(ctx, { companyId: CUSTOMER, name: 'X' })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});

describe('serial writes', () => {
  const base = {
    companyId: CUSTOMER,
    siteId: SITE,
    familyId: FAMILY,
    modelId: MODEL,
    serialNumber: 'ATLAS-DEMO-001',
    optionValues: { profile: 'LAB-A' },
  };

  it('registers a serial for an OEM admin, validating parents + option values', async () => {
    const serialRow = { id: NEW_ID, tenantId: TENANT, companyId: CUSTOMER };
    const { ctx, events } = makeContext(adminActor, fullCanned(), serialRow);
    const row = await createSerial(ctx, base);

    expect(row.id).toBe(NEW_ID);
    expect(events).toContainEqual(expect.objectContaining({ action: 'serial.created' }));
  });

  it('rejects an option value the model does not define', async () => {
    const { ctx } = makeContext(adminActor, fullCanned(), { id: NEW_ID });
    await expect(
      createSerial(ctx, { ...base, optionValues: { material: 'Unobtainium' } }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a site that belongs to a different customer', async () => {
    const { ctx } = makeContext(adminActor, fullCanned(), { id: NEW_ID });
    await expect(createSerial(ctx, { ...base, companyId: OTHER_CUSTOMER })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('denies a customer actor from registering a serial', async () => {
    const { ctx } = makeContext(customerActor, fullCanned(), { id: NEW_ID });
    await expect(createSerial(ctx, base)).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('catalog writes', () => {
  const familyInput = {
    key: 'metal-am-lpbf',
    name: 'Metal AM / LPBF printers',
    description: '',
    iconKey: '',
  };
  const modelInput = {
    familyId: FAMILY,
    key: 'atlas-training',
    name: 'Atlas Training Cell',
    description: '',
    imageUrl: '',
  };
  const axisInput = {
    modelId: MODEL,
    key: 'profile',
    label: 'Training profile',
    dataType: 'enum' as const,
    options: ['LAB-A', 'LAB-B'],
    unit: '',
    safetyRelevant: true,
  };

  it('creates a family for an OEM admin and audits it as a Catalog subject', async () => {
    const { ctx, events } = makeContext(adminActor, new Map(), {
      ...familyRow,
      id: NEW_ID,
      key: 'metal-am-lpbf',
      name: 'Metal AM / LPBF printers',
    });
    const row = await createMachineFamily(ctx, familyInput);
    expect(row.id).toBe(NEW_ID);
    expect(events).toContainEqual(
      expect.objectContaining({
        action: 'machine_family.created',
        subjectType: 'Catalog',
        subjectId: NEW_ID,
      }),
    );
  });

  it('lets any OEM staffer (not just admins) read the catalog — the form pickers', async () => {
    const { ctx } = makeContext(techActor, new Map([[machineFamilies, [familyRow]]]), familyRow);
    await expect(listMachineFamilies(ctx)).resolves.toHaveLength(1);
  });

  it('denies a non-admin staffer from authoring the catalog', async () => {
    const { ctx } = makeContext(techActor, new Map(), familyRow);
    await expect(createMachineFamily(ctx, familyInput)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('denies a customer actor from reading or authoring the catalog', async () => {
    const { ctx } = makeContext(customerActor, new Map(), familyRow);
    await expect(listMachineFamilies(ctx)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(createMachineFamily(ctx, familyInput)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('rejects an invalid family key at the validation edge', async () => {
    const { ctx } = makeContext(adminActor, new Map(), familyRow);
    await expect(
      createMachineFamily(ctx, { ...familyInput, key: 'Not A Key' }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('creates a model under an existing family and audits it', async () => {
    const canned = new Map<unknown, unknown[]>([[machineFamilies, [familyRow]]]);
    const { ctx, events } = makeContext(adminActor, canned, {
      ...modelRow,
      id: NEW_ID,
      key: 'atlas-training',
      name: 'Atlas Training Cell',
    });
    const row = await createMachineModel(ctx, modelInput);
    expect(row.id).toBe(NEW_ID);
    expect(events).toContainEqual(
      expect.objectContaining({ action: 'machine_model.created', subjectType: 'Catalog' }),
    );
  });

  it('404s when creating a model under a family not in scope', async () => {
    const { ctx } = makeContext(adminActor, new Map([[machineFamilies, []]]), { id: NEW_ID });
    await expect(createMachineModel(ctx, modelInput)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('creates a variant axis under an existing model and audits it', async () => {
    const canned = new Map<unknown, unknown[]>([[machineModels, [modelRow]]]);
    const { ctx, events } = makeContext(adminActor, canned, {
      id: NEW_ID,
      tenantId: TENANT,
      modelId: MODEL,
      key: 'material',
    });
    const row = await createVariantAxis(ctx, axisInput);
    expect(row.id).toBe(NEW_ID);
    expect(events).toContainEqual(
      expect.objectContaining({ action: 'variant_axis.created', subjectType: 'Catalog' }),
    );
  });

  it('rejects an enum axis with no allowed values', async () => {
    const { ctx } = makeContext(adminActor, new Map([[machineModels, [modelRow]]]), { id: NEW_ID });
    await expect(createVariantAxis(ctx, { ...axisInput, options: [] })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('refuses to delete a family that still has models', async () => {
    const canned = new Map<unknown, unknown[]>([
      [machineFamilies, [familyRow]],
      [machineModels, [modelRow]],
    ]);
    const { ctx } = makeContext(adminActor, canned, familyRow);
    await expect(deleteMachineFamily(ctx, { id: FAMILY })).rejects.toBeInstanceOf(ConflictError);
  });

  it('deletes an empty family and audits it', async () => {
    const canned = new Map<unknown, unknown[]>([
      [machineFamilies, [familyRow]],
      [machineModels, []],
    ]);
    const { ctx, events } = makeContext(adminActor, canned, familyRow);
    const result = await deleteMachineFamily(ctx, { id: FAMILY });
    expect(result.id).toBe(FAMILY);
    expect(events).toContainEqual(
      expect.objectContaining({ action: 'machine_family.deleted', subjectType: 'Catalog' }),
    );
  });
});
