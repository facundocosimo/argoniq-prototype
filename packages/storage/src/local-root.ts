/* eslint-disable no-restricted-globals -- `process.cwd` is the anchor for locating
   the monorepo root; it is a working-directory lookup, not app configuration. */
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

/**
 * Anchor the local-disk storage root so every process agrees on one directory.
 * `STORAGE_LOCAL_ROOT` is CWD-relative by default, but the web app (cwd
 * `apps/portal-web`) and the worker (cwd `services/worker`) have different CWDs — so a
 * bare `.storage` would resolve to two different folders and the worker could not read
 * what the uploader wrote. This resolves a RELATIVE root against the monorepo root
 * (the nearest ancestor of cwd holding `pnpm-workspace.yaml`); an ABSOLUTE root is used
 * as-is (the production S3/R2 path never touches this).
 */
export function resolveLocalRoot(configured: string): string {
  if (isAbsolute(configured)) return configured;
  return join(monorepoRoot() ?? process.cwd(), configured);
}

function monorepoRoot(): string | null {
  let dir = process.cwd();
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Convenience: a {@link resolveLocalRoot}'d absolute path. */
export function absoluteLocalRoot(configured: string): string {
  return resolve(resolveLocalRoot(configured));
}
