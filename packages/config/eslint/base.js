import js from '@eslint/js';
import turbo from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Base ESLint flat config for every TypeScript package.
 *
 * Shared project rules:
 *  - no `any` at boundaries, no floating promises, type-checked rules on;
 *  - centralized logging only — `console` is banned (use @argoniq/observability);
 *  - consistent inline type-imports so `verbatimModuleSyntax` stays clean.
 *
 * @type {import('typescript-eslint').ConfigArray}
 */
export const base = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/*.config.{js,cjs,mjs,ts}',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    plugins: { turbo },
    rules: {
      'turbo/no-undeclared-env-vars': 'error',
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message: 'Import validated config from @argoniq/core-domain/env, not process.env.',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      // We deliberately use `type` aliases (composable, consistent with zod
      // inference) alongside `interface` where it reads better. Don't force one.
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true, allowBoolean: true },
      ],
    },
  },
  // The env loader is the one place allowed to read process.env.
  {
    files: ['**/env.ts', '**/env/*.ts'],
    rules: { 'no-restricted-globals': 'off' },
  },
  prettier,
);

export default base;
