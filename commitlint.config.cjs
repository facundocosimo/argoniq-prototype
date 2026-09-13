/**
 * Conventional Commits, enforced on commit-msg (Husky).
 * Scopes mirror the monorepo topology so history is navigable by package.
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      1,
      'always',
      [
        'repo',
        'config',
        'core-domain',
        'contracts',
        'observability',
        'auth',
        'db',
        'notifications',
        'core',
        'intelligence',
        'ui',
        'portal-web',
        'admin-console',
        'worker',
        'evals',
        'docs',
      ],
    ],
    'body-max-line-length': [0, 'always'],
  },
};
