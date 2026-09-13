// Isolated local PostgreSQL lifecycle. Never uses the application's remote DATABASE_URL.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const dir = join(root, '.dev');
const data = join(dir, 'pgdata');
const configFile = join(dir, 'database.env');
const require = createRequire(new URL('../../packages/db/package.json', import.meta.url));
const postgres = require('postgres');
const bin =
  process.env.PG_BIN ??
  (process.platform === 'darwin'
    ? '/opt/homebrew/opt/postgresql@17/bin'
    : '/usr/lib/postgresql/17/bin');
function run(command, args, options = {}) {
  const result = spawnSync(join(bin, command), args, { encoding: 'utf8', ...options });
  if (result.status !== 0)
    throw new Error(`${command} failed: ${result.stderr || result.error || result.stdout}`);
  return result.stdout;
}
const action = process.argv[2] ?? 'start';
if (!['setup', 'start', 'stop', 'grant'].includes(action))
  throw new Error('Use setup, start, stop or grant.');
if (action === 'setup' && !existsSync(configFile)) {
  if (existsSync(join(data, 'PG_VERSION')))
    throw new Error('Database exists without its credentials; restore database.env.');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const ownerPassword = randomBytes(24).toString('hex');
  const appPassword = randomBytes(24).toString('hex');
  writeFileSync(join(dir, 'owner-password'), ownerPassword, { mode: 0o600 });
  writeFileSync(
    configFile,
    [
      `DATABASE_URL=postgresql://argoniq_app:${appPassword}@127.0.0.1:55440/argoniq_dev`,
      `DATABASE_MIGRATION_URL=postgresql://argoniq_owner:${ownerPassword}@127.0.0.1:55440/argoniq_dev`,
      `PGBOSS_DATABASE_URL=postgresql://argoniq_owner:${ownerPassword}@127.0.0.1:55440/argoniq_dev`,
      `STORAGE_LOCAL_ROOT=${join(dir, 'storage')}`,
    ].join('\n') + '\n',
    { mode: 0o600 },
  );
}
if (!existsSync(configFile)) throw new Error('Run node tools/dev/database.mjs setup first.');
if (action === 'setup' && !existsSync(join(data, 'PG_VERSION'))) {
  run('initdb', [
    '-D',
    data,
    '-U',
    'argoniq_owner',
    '--encoding=UTF8',
    '--locale=C',
    '--auth-host=scram-sha-256',
    '--auth-local=scram-sha-256',
    '--pwfile',
    join(dir, 'owner-password'),
  ]);
}
const running = spawnSync(join(bin, 'pg_ctl'), ['status', '-D', data]).status === 0;
if (action === 'stop') {
  if (running) run('pg_ctl', ['stop', '-D', data, '-m', 'fast', '-w', '-t', '30']);
  console.log('Development database stopped.');
} else {
  if (!running)
    run('pg_ctl', [
      'start',
      '-D',
      data,
      '-l',
      join(dir, 'postgres.log'),
      '-o',
      `-p 55440 -h 127.0.0.1 -k ${dir}`,
      '-w',
      '-t',
      '30',
    ]);
  if (action === 'setup' || action === 'grant') {
    const config = parseEnv(readFileSync(configFile, 'utf8'));
    const ownerUrl = new URL(config.DATABASE_MIGRATION_URL);
    const appPassword = decodeURIComponent(new URL(config.DATABASE_URL).password);
    ownerUrl.pathname = action === 'setup' ? '/postgres' : '/argoniq_dev';
    const sql = postgres(ownerUrl.toString(), { max: 1 });
    try {
      if (action === 'setup') {
        if (!(await sql`select 1 from pg_roles where rolname = 'argoniq_app'`).length)
          await sql.unsafe(
            `CREATE ROLE argoniq_app LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD '${appPassword}'`,
          );
        if (!(await sql`select 1 from pg_database where datname = 'argoniq_dev'`).length)
          await sql.unsafe('CREATE DATABASE argoniq_dev OWNER argoniq_owner');
      } else {
        await sql.unsafe('GRANT USAGE ON SCHEMA public TO argoniq_app');
        await sql.unsafe(
          'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO argoniq_app',
        );
        await sql.unsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO argoniq_app');
        await sql.unsafe(
          'ALTER DEFAULT PRIVILEGES FOR ROLE argoniq_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO argoniq_app',
        );
      }
    } finally {
      await sql.end();
    }
  }
  console.log(
    'Development PostgreSQL ready at 127.0.0.1:55440/argoniq_dev. Credentials: .dev/database.env',
  );
}
