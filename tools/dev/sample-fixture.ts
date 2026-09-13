import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { getEnv } from '../../packages/core-domain/src/env/index.js';
import { TenantId } from '../../packages/core-domain/src/ids.js';
import { createDatabase } from '../../packages/db/src/client.js';
import { DrizzleDocumentRepository } from '../../packages/db/src/repositories/document-repository.js';
import {
  tenants,
  companies,
  sites,
  contacts,
  machineFamilies,
  machineModels,
  serials,
  cases,
  documents,
  authUsers,
  authAccounts,
  memberships,
} from '../../packages/db/src/schema/index.js';
import { LocalDiskStorage } from '../../packages/storage/src/local-disk-storage.js';
import { PdfjsParser } from '../../services/worker/src/ingestion/pdfjs-parser.js';
import { ingestDocumentJob } from '../../services/worker/src/jobs/ingest-document.js';
import { getLogger } from '../../packages/observability/src/logger.js';
import { eq } from '../../packages/db/node_modules/drizzle-orm/index.js';

export const sampleId = (n: number) => `a1000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
export const SAMPLE = {
  tenant: sampleId(1),
  company: sampleId(2),
  site: sampleId(3),
  antwerpSite: sampleId(10),
  family: sampleId(4),
  atlas: sampleId(5),
  nova: sampleId(6),
  serial: sampleId(7),
  nova14: sampleId(11),
  atlas25: sampleId(12),
  nova29: sampleId(13),
  elena: sampleId(14),
  caseStartup: sampleId(15),
  caseInspection: sampleId(16),
  operator: sampleId(8),
  admin: sampleId(9),
};

export function requireSampleDatabase() {
  const env = getEnv();
  for (const value of [env.DATABASE_URL, env.DATABASE_MIGRATION_URL]) {
    if (!value) throw new Error('Both database roles must be configured.');
    const url = new URL(value);
    if (url.hostname !== '127.0.0.1' || url.port !== '55440' || url.pathname !== '/argoniq_dev')
      throw new Error('Samples only write the isolated local argoniq_dev database on port 55440.');
  }
  return env;
}

/** Seed only dedicated fictional records. Never reset an existing account/password or unrelated data. */
export async function seedSampleFixture() {
  const env = requireSampleDatabase();
  const db = createDatabase(env.DATABASE_MIGRATION_URL);
  try {
    const tenantId = TenantId.parse(SAMPLE.tenant);
    await db
      .insert(tenants)
      .values({
        id: tenantId,
        name: 'Atlas Industrial Systems — synthetic demo',
        slug: 'atlas-industrial-demo',
      })
      .onConflictDoNothing();
    await db
      .insert(companies)
      .values({
        id: SAMPLE.company,
        tenantId,
        name: 'Northstar Components — synthetic demo',
      })
      .onConflictDoNothing();
    await db
      .insert(sites)
      .values([
        {
          id: SAMPLE.site,
          tenantId,
          companyId: SAMPLE.company,
          name: 'Ghent Assembly Plant — synthetic demo',
          countryCode: 'BE',
        },
        {
          id: SAMPLE.antwerpSite,
          tenantId,
          companyId: SAMPLE.company,
          name: 'Antwerp Test Lab — synthetic demo',
          countryCode: 'BE',
        },
      ])
      .onConflictDoNothing();
    await db
      .insert(contacts)
      .values({
        id: SAMPLE.elena,
        tenantId,
        companyId: SAMPLE.company,
        siteId: SAMPLE.site,
        name: 'Elena Rossi',
        title: 'Maintenance Manager',
        role: 'maintenance',
        email: 'elena.rossi@northstar.example',
        isPrimary: true,
      })
      .onConflictDoNothing();
    await db
      .insert(machineFamilies)
      .values({ id: SAMPLE.family, tenantId, key: 'training', name: 'Training equipment' })
      .onConflictDoNothing();
    await db
      .insert(machineModels)
      .values([
        {
          id: SAMPLE.atlas,
          tenantId,
          familyId: SAMPLE.family,
          key: 'atlas-training',
          name: 'Atlas Training Cell (fictional)',
        },
        {
          id: SAMPLE.nova,
          tenantId,
          familyId: SAMPLE.family,
          key: 'nova-training',
          name: 'Nova Training Cell (fictional)',
        },
      ])
      .onConflictDoNothing();
    await db
      .insert(serials)
      .values([
        {
          id: SAMPLE.serial,
          tenantId,
          companyId: SAMPLE.company,
          siteId: SAMPLE.site,
          familyId: SAMPLE.family,
          modelId: SAMPLE.atlas,
          serialNumber: 'ATLAS-DEMO-001',
          customerTag: 'Ghent Cell A-04',
          firmwareVersion: '3.2.1',
          status: 'active',
        },
        {
          id: SAMPLE.nova14,
          tenantId,
          companyId: SAMPLE.company,
          siteId: SAMPLE.site,
          familyId: SAMPLE.family,
          modelId: SAMPLE.nova,
          serialNumber: 'NOVA-DEMO-014',
          firmwareVersion: '2.4.1',
          status: 'active',
        },
        {
          id: SAMPLE.atlas25,
          tenantId,
          companyId: SAMPLE.company,
          siteId: SAMPLE.antwerpSite,
          familyId: SAMPLE.family,
          modelId: SAMPLE.atlas,
          serialNumber: 'ATLAS-DEMO-025',
          firmwareVersion: '3.1.0',
          status: 'not_installed',
        },
        {
          id: SAMPLE.nova29,
          tenantId,
          companyId: SAMPLE.company,
          siteId: SAMPLE.site,
          familyId: SAMPLE.family,
          modelId: SAMPLE.nova,
          serialNumber: 'NOVA-DEMO-029',
          firmwareVersion: '2.3.8',
          status: 'maintenance',
        },
      ])
      .onConflictDoNothing();
    await db
      .insert(cases)
      .values([
        {
          id: SAMPLE.caseStartup,
          tenantId,
          companyId: SAMPLE.company,
          siteId: SAMPLE.site,
          serialId: SAMPLE.serial,
          status: 'open',
          summary: 'GAS-01 appears during startup; safe next step requested.',
        },
        {
          id: SAMPLE.caseInspection,
          tenantId,
          companyId: SAMPLE.company,
          siteId: SAMPLE.site,
          serialId: SAMPLE.serial,
          status: 'open',
          summary: 'Follow-up inspection requested for the Atlas training cell.',
        },
      ])
      .onConflictDoNothing();
    const require = createRequire(new URL('../../apps/portal-web/package.json', import.meta.url));
    const { hashPassword } = await import(require.resolve('better-auth/crypto'));
    for (const [id, role] of [
      [SAMPLE.operator, 'operator'],
      [SAMPLE.admin, 'admin'],
    ] as const) {
      await db
        .insert(authUsers)
        .values({
          id,
          name: `Training ${role}`,
          email: `${role}@training.invalid`,
          emailVerified: true,
        })
        .onConflictDoNothing();
      await db
        .insert(authAccounts)
        .values({
          userId: id,
          accountId: id,
          issuer: 'local:credential',
          providerId: 'credential',
          password: await hashPassword('Training-only-password-2026'),
        })
        .onConflictDoNothing();
      await db
        .insert(memberships)
        .values({
          tenantId,
          userId: id,
          role,
          companyId: role === 'operator' ? SAMPLE.company : null,
        })
        .onConflictDoNothing();
    }
    const manuals = JSON.parse(
      await readFile(new URL('./manuals.json', import.meta.url), 'utf8'),
    ) as {
      key: string;
      title: string;
      language: string;
      tier: 'T1' | 'T3';
      model: 'atlas' | 'nova';
    }[];
    const repository = new DrizzleDocumentRepository(db);
    const storage = new LocalDiskStorage({ root: env.STORAGE_LOCAL_ROOT });
    const logger = getLogger({ module: 'sample-fixture' });
    for (const [index, manual] of manuals.entries()) {
      const id = sampleId(20 + index);
      const bytes = new Uint8Array(
        await readFile(new URL(`../../output/pdf/${manual.key}.pdf`, import.meta.url)),
      );
      const hash = createHash('sha256').update(bytes).digest('hex');
      const [existing] = await db.select().from(documents).where(eq(documents.id, id));
      const storageKey = `tenants/${tenantId}/documents/${id}/source.pdf`;
      if (existing?.fileHash === hash && existing.status === 'ingested') {
        if (existing.storageKey !== storageKey) {
          await storage.put(storageKey, bytes);
          await db.update(documents).set({ storageKey }).where(eq(documents.id, id));
        }
        continue;
      }
      if (existing)
        throw new Error(
          'Sample source changed; use a new revision/ID rather than rewriting cited bytes.',
        );
      await storage.put(storageKey, bytes);
      await db.insert(documents).values({
        id,
        tenantId,
        title: manual.title,
        tier: manual.tier,
        familyId: SAMPLE.family,
        modelId: SAMPLE[manual.model],
        language: manual.language,
        sourceType: 'manual_pdf',
        category: 'operation',
        storageKey,
        fileHash: hash,
        originalFilename: `${manual.key}.pdf`,
        mimeType: 'application/pdf',
        revisionLabel: 'A',
        docKey: manual.key,
        indexable: true,
        isCurrent: true,
      });
      await ingestDocumentJob(
        {
          documents: repository,
          storage,
          parser: new PdfjsParser(),
          enqueueEmbed: async () => {},
          logger,
        },
        { tenantId, documentId: id },
      );
    }
    // createDatabase owns a postgres.js client. End fixture-only connections after the seed.
    return SAMPLE;
  } finally {
    await db.$client.end();
  }
}
