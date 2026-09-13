/**
 * PostCSS config — Tailwind v4 runs through its dedicated PostCSS plugin. The
 * design tokens and base layer live in the @argoniq/ui stylesheet, imported
 * once in the root layout; this app adds no bespoke global CSS.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
