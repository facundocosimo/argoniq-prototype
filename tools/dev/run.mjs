// One environment boundary shared by portal, worker, migration and sample commands.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const env = {
  ...process.env,
  ...parseEnv(readFileSync(resolve(root, '.env'), 'utf8')),
  ...parseEnv(readFileSync(resolve(root, '.dev/database.env'), 'utf8')),
  NODE_ENV: 'development',
  APP_URL: 'http://127.0.0.1:3100',
  ALLOWED_ORIGINS: 'http://127.0.0.1:3100,http://localhost:3100',
  DEMO_AUTH_ENABLED: 'false',
};
const command = process.argv[2];
const entrypoints = {
  migrate: 'packages/db/src/migrate.ts',
  seed: 'tools/dev/seed.ts',
  samples: 'tools/dev/samples.ts',
  'support-samples': 'tools/dev/support-samples.ts',
  worker: 'services/worker/src/index.ts',
};
let args;
let cwd = root;
if (command === 'portal') {
  cwd = resolve(root, 'apps/portal-web');
  args = [
    resolve(cwd, 'node_modules/next/dist/bin/next'),
    'dev',
    '--webpack',
    '--hostname',
    '127.0.0.1',
    '--port',
    '3100',
  ];
} else {
  if (!entrypoints[command]) throw new Error('Use portal, worker, migrate, seed or samples.');
  args = [
    '--import',
    resolve(root, 'packages/db/node_modules/tsx/dist/loader.mjs'),
    resolve(root, entrypoints[command]),
    ...process.argv.slice(3),
  ];
  if (command === 'samples' || command === 'support-samples') {
    env.AI_DEBUG_TRANSCRIPT = 'false';
    env.LOG_LEVEL = 'warn';
  }
}
// Portal development includes ingestion: uploads must not depend on remembering a second terminal.
const worker =
  command === 'portal'
    ? spawn(
        process.execPath,
        [
          '--import',
          resolve(root, 'packages/db/node_modules/tsx/dist/loader.mjs'),
          resolve(root, 'services/worker/src/index.ts'),
        ],
        { cwd: root, env, stdio: 'inherit' },
      )
    : null;
const child = spawn(process.execPath, args, { cwd, env, stdio: 'inherit' });
worker?.on('error', (error) => {
  console.error('Ingestion worker failed:', error.message);
  child.kill('SIGTERM');
});
worker?.on('exit', (code, signal) => {
  if (code !== 0 && !signal) {
    console.error('Ingestion worker exited; stopping the development stack.');
    child.kill('SIGTERM');
  }
});
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    child.kill(signal);
    worker?.kill(signal);
  });
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  worker?.kill('SIGTERM');
  process.exitCode = code ?? 1;
});
