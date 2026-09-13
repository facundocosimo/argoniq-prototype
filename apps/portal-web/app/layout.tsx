import { type JSX, type ReactNode } from 'react';
import { type Metadata } from 'next';
import { Schibsted_Grotesk, IBM_Plex_Mono } from 'next/font/google';
// App CSS entry: imports the design-system styles (@argoniq/ui/styles.css)
// and declares the Tailwind v4 @source scan paths (see app/globals.css).
import './globals.css';
import { Providers } from './providers.js';

/** Shared document, fonts and providers. The dashboard layout owns authenticated chrome. */
export const metadata: Metadata = {
  title: 'ArgonIQ',
  description: 'AI aftersales support for industrial machinery.',
};

/**
 * Instrument type pair, self-hosted and subsetted by next/font (no layout-shift, no
 * third-party request at runtime):
 *   · Schibsted Grotesk — a neutral grotesk for UI + display; precise, quietly
 *     industrial. Exposed as `--mm-font-schibsted`, resolved first by `--mm-font-sans`.
 *   · IBM Plex Mono — data type for serials, counts, tiers and tabular numbers.
 *     Exposed as `--mm-font-plex-mono`, resolved first by `--mm-font-mono`.
 * See tokens.css for how the tokens consume these variables.
 */
const schibsted = Schibsted_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--mm-font-schibsted',
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--mm-font-plex-mono',
});

/**
 * Blocking pre-paint script. Resolves the theme before first paint —
 * stored preference, else the OS `prefers-color-scheme`, else light — and stamps
 * `data-theme` on <html> so the correct token set is live immediately (no flash of
 * the wrong theme). `useTheme` then reconciles React state from this attribute.
 */
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('mm-theme');var t=s==='dark'||s==='light'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export default function RootLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${schibsted.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
