import { type NextConfig } from 'next';

/**
 * Internal packages export TypeScript source, so Next transpiles each package the
 * application imports. The code uses explicit `.js` import specifiers for ESM;
 * `extensionAlias` lets webpack resolve those specifiers to TypeScript sources.
 */
const config: NextConfig = {
  agentRules: false,
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/manage/catalog/models/:id', destination: '/manage/models/:id', permanent: true },
      { source: '/manage/models/models/:id', destination: '/manage/models/:id', permanent: true },
      {
        source: '/manage/customers/:path*',
        destination: '/manage/companies/:path*',
        permanent: true,
      },
      {
        source: '/manage/knowledge/:path*',
        destination: '/manage/documents/:path*',
        permanent: true,
      },
      { source: '/manage/catalog/:path*', destination: '/manage/models/:path*', permanent: true },
      { source: '/manage/machines', destination: '/machines', permanent: true },
    ];
  },
  transpilePackages: [
    '@argoniq/auth',
    '@argoniq/contracts',
    '@argoniq/core',
    '@argoniq/core-domain',
    '@argoniq/db',
    '@argoniq/notifications',
    '@argoniq/observability',
    '@argoniq/ui',
  ],
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
      '.cjs': ['.cts', '.cjs'],
    };
    return webpackConfig;
  },
};

export default config;
