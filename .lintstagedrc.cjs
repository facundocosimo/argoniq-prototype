/**
 * Pre-commit quality gate (lint-staged). Fast, file-scoped checks only — the full
 * typecheck/test/eval suite runs in CI (.github/workflows/ci.yml).
 *
 * This is a pnpm WORKSPACE: `eslint` and the shared flat config (`@argoniq/config`)
 * are per-package devDependencies, NOT installed at the repo root — so a bare root
 * `eslint` is unresolvable (ENOENT). We therefore lint each staged file with ITS OWN
 * package's eslint: files are grouped by their workspace package and run through
 * `pnpm --dir <pkg> exec eslint`, so every file is checked with exactly the config
 * `pnpm lint` would use. Prettier IS a root devDependency, so it runs once from the
 * root for all matched files.
 */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = __dirname;

/** The nearest ancestor workspace-package dir for an absolute file path, or null (root-level). */
function packageDirOf(absFile) {
  let dir = path.dirname(absFile);
  while (dir.startsWith(ROOT) && dir !== ROOT) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    dir = path.dirname(dir);
  }
  return null;
}

/** Shell-quote a path (file paths carry no shell metacharacters; quotes guard spaces). */
const quote = (p) => JSON.stringify(p);

module.exports = {
  '*.{ts,tsx}': (files) => {
    // Group staged files by their owning package so each runs under that package's
    // eslint binary + flat config (type-aware rules included, matching CI).
    const byPackage = new Map();
    for (const file of files) {
      const abs = path.resolve(ROOT, file);
      const dir = packageDirOf(abs);
      if (!dir) continue; // root-level TS (rare): formatting only, no package eslint
      const group = byPackage.get(dir) ?? [];
      group.push(path.relative(dir, abs));
      byPackage.set(dir, group);
    }

    const commands = [];
    for (const [dir, relFiles] of byPackage) {
      commands.push(
        `pnpm --dir ${quote(dir)} exec eslint --max-warnings=0 --fix ${relFiles.map(quote).join(' ')}`,
      );
    }
    // Prettier (root devDependency) formats every matched file in one pass.
    commands.push(`prettier --write ${files.map(quote).join(' ')}`);
    return commands;
  },
  '*.{json,css,md,mdx,yaml,yml}': 'prettier --write',
};
