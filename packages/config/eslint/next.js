import nextPlugin from '@next/eslint-plugin-next';
import { react } from './react.js';

/**
 * ESLint flat config for Next.js apps (apps/portal-web, apps/admin-console).
 *
 * @type {import('eslint').Linter.Config[]}
 */
export const next = [
  ...react,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { '@next/next': nextPlugin },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
    },
  },
];

export default next;
