import { type CSSProperties, type JSX, useId } from 'react';
import { cn } from '../lib/cn.js';

/* ---------------------------------------------------------------------------
 * ArgonIQ identity, shared across the public landing surface and app chrome.
 *
 * The logomark is the recovered blue spherical swirl from the earlier ArgonIQ
 * brand system. The wordmark follows that system too: lowercase "argon" with a
 * stronger "iq" finish. The mark is fixed-color; the "argon" text inherits
 * currentColor so it stays legible on both dark hero chrome and paper surfaces.
 * ------------------------------------------------------------------------- */

export interface LogoMarkProps {
  /** Rendered width/height in px. */
  size?: number;
  className?: string;
  /** Soft halo behind the spherical mark. */
  glow?: boolean;
}

export function LogoMark({ size = 36, className, glow = true }: LogoMarkProps): JSX.Element {
  const svgId = useId().replaceAll(':', '');
  const shadowId = `aq-swirl-shadow-${svgId}`;
  const lightId = `aq-swirl-light-${svgId}`;
  const glowId = `aq-swirl-glow-${svgId}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 247 260"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={shadowId}
          gradientUnits="userSpaceOnUse"
          x1="39.271255%"
          y1="60%"
          x2="81.37652%"
          y2="83.07692%"
        >
          <stop offset="0%" stopColor="#5572e6" />
          <stop offset="100%" stopColor="#4357cb" />
        </linearGradient>
        <linearGradient
          id={lightId}
          gradientUnits="userSpaceOnUse"
          x1="7.2874494%"
          y1="46.923077%"
          x2="77.327934%"
          y2="46.923077%"
        >
          <stop offset="0%" stopColor="#6da7f7" />
          <stop offset="100%" stopColor="#5575e6" />
        </linearGradient>
        <filter
          id={glowId}
          x="-18%"
          y="-18%"
          width="136%"
          height="136%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>

      {glow && (
        <ellipse
          cx="123.5"
          cy="130"
          rx="91"
          ry="94"
          fill="#2c74f1"
          opacity="0.16"
          filter={`url(#${glowId})`}
        />
      )}

      <path
        fill={`url(#${lightId})`}
        d="M 122.2 241.4 c -13.3 -3.5 -25.8 -13.3 -31.9 -24.9 -6.4 -12.2 -7.7 -18.3 -7.6 -35.5 0.2 -18.1 1.7 -26.1 6.8 -35.9 5.4 -10.2 15.2 -19.4 25.7 -24.1 4.2 -1.8 4.2 -1.9 1.3 -1.9 -5.3 -0.1 -23.9 2.7 -28.3 4.3 -10.4 3.7 -20.8 10.1 -27.8 17.1 -22.1 22.1 -22.8 55.1 -1.8 81 2.5 3 4.1 5.5 3.6 5.5 -2 0 -18.8 -16.9 -24.9 -25 -21.3 -28.1 -28.1 -67.9 -17.7 -103.9 8.8 -30.4 29.4 -55.8 56 -69 32 -15.9 74.7 -14.6 104.9 3.1 12.3 7.2 29.9 24.8 37 36.8 7.1 12.3 11.1 22.1 14.2 35.1 3.6 15.4 3.9 38.4 0.5 52.4 -3.1 13 -6.5 22.6 -11.2 31.1 -15.4 27.8 -40 47.6 -67 53.9 -8.1 1.8 -24.8 1.8 -31.8 -0.1 z"
      />
      <path
        fill={`url(#${lightId})`}
        d="M 122.2 241.4 c -13.3 -3.5 -25.8 -13.3 -31.9 -24.9 -6.4 -12.2 -7.7 -18.3 -7.6 -35.5 0.2 -18.2 1.7 -26.1 7 -36.2 4.1 -7.9 12.1 -15.3 23 -21.6 7.8 -4.5 7 -4.7 -8.9 -2.9 -11.3 1.3 -11.7 1.3 -10.1 -0.5 1.3 -1.4 1.3 -1.8 0.2 -1.8 -1 0 -1 -0.3 -0.3 -0.8 0.6 -0.4 1.5 -2.6 1.8 -4.8 0.4 -2.3 2.3 -7.2 4.2 -11 1.9 -3.7 3.4 -7.3 3.4 -7.9 0 -0.5 1.1 -4.4 2.4 -8.5 1.3 -4.1 2.6 -10.6 3 -14.5 0.4 -3.8 1.1 -8.4 1.7 -10.1 1.1 -3.6 1.8 -30.8 0.9 -34.4 -0.9 -3.2 -0.2 -5 1.6 -5 0.9 0 1.3 -0.4 1 -0.9 -1.6 -2.4 17.9 -2.8 30.8 -0.6 24.1 4.2 39.3 12.1 56.6 29.5 16.6 16.6 25.3 32.2 30.7 55.1 3.6 15.4 3.9 38.4 0.5 52.4 -3.1 13 -6.5 22.6 -11.2 31.1 -15.4 27.8 -40 47.6 -67 53.9 -8.1 1.8 -24.8 1.8 -31.8 -0.1 z"
      />
      <path
        fill={`url(#${lightId})`}
        d="M 52.6 218.9 c -10 -9.4 -20.6 -22.9 -20.6 -26.3 0 -1.1 7.4 -0.3 8.3 0.8 0.6 0.8 1 0.7 1.4 -0.2 0.6 -1.6 2.3 -0.5 2.3 1.6 0 3.1 9 19.7 14.1 26 2.7 3.4 4.6 6.2 4.1 6.2 -0.5 0 -4.8 -3.7 -9.6 -8.1 z"
      />
      <path
        fill={`url(#${lightId})`}
        d="M 122.2 241.4 c -13.3 -3.5 -25.8 -13.3 -31.9 -24.9 -6.4 -12.2 -7.7 -18.3 -7.6 -35.5 0.2 -25.8 4.6 -38.1 17.7 -49.2 11.1 -9.2 16.7 -11.5 30.6 -12.2 13.6 -0.6 25.2 -2.9 29.4 -5.7 3.3 -2.1 3.2 -2.2 -3.6 -0.3 -2.3 0.7 -2.5 -2.8 -0.3 -4.6 0.8 -0.7 1.5 -1.8 1.5 -2.4 0 -0.6 0.9 -2.7 1.9 -4.7 2.7 -5 6.7 -18.4 7.5 -24.9 0.4 -3 0.9 -11.7 1.2 -19.2 0.4 -10.7 0.2 -14.9 -1 -19 -1.4 -4.8 -2.8 -12.8 -2.2 -12.8 0.1 0 2.9 0.9 6.1 2.1 9.4 3.3 21.2 11.8 31.6 22.7 14.7 15.5 23.6 32.1 28.6 53.3 3.6 15.4 3.9 38.4 0.5 52.4 -3.1 13 -6.5 22.6 -11.2 31.1 -15.4 27.8 -40 47.6 -67 53.9 -8.1 1.8 -24.8 1.8 -31.8 -0.1 z"
      />
      <path
        fill={`url(#${shadowId})`}
        d="M 122.2 241.4 c -13.3 -3.5 -25.8 -13.3 -31.9 -24.9 -6.4 -12.2 -7.7 -18.3 -7.6 -35.5 0.2 -25.8 4.6 -38.1 17.7 -49.1 10.2 -8.6 17.3 -11.9 25.5 -11.9 23.6 0 44 -6.7 55.1 -18.1 14.6 -14.9 16.7 -35.7 5.9 -57.2 -2.4 -4.8 -2.7 -5.9 -1.4 -6.3 2.9 -1.2 8.4 2.7 17.6 12.5 14.7 15.4 23.6 32 28.6 53.2 3.6 15.4 3.9 38.4 0.5 52.4 -3.1 13 -6.5 22.6 -11.2 31.1 -15.4 27.8 -40 47.6 -67 53.9 -8.1 1.8 -24.8 1.8 -31.8 -0.1 z"
      />
      <path
        fill="#465cd0"
        d="M 122.1 241.4 c -7.6 -2 -17.3 -8.4 -12.8 -8.4 0.8 0 0.7 -0.4 -0.3 -1 -1.1 -0.7 -1.1 -1 -0.2 -1 2.1 0 6.1 -5.2 7.4 -9.5 0.6 -2.2 1.6 -4.6 2.2 -5.4 0.6 -0.7 1.5 -2.3 2.1 -3.5 1.7 -3.5 5.9 -4.9 10.1 -3.6 1.9 0.7 3.8 0.9 4.1 0.6 0.3 -0.3 -0.3 -0.8 -1.3 -1.2 -19.7 -6.4 -36.2 -18.8 -43.3 -32.4 -1.9 -3.6 -4.2 -7.5 -5.3 -8.6 -1.8 -2 -1.8 -2.4 -0.3 -8.9 2.5 -11.1 7.7 -19.8 15.9 -26.6 10.2 -8.6 17.3 -11.9 25.5 -11.9 23.6 0 44 -6.7 55.1 -18.1 14.6 -14.9 16.7 -35.7 5.9 -57.2 -2.4 -4.8 -2.7 -5.9 -1.4 -6.3 2.9 -1.2 8.4 2.7 17.6 12.5 14.7 15.4 23.6 32 28.6 53.2 3.6 15.4 3.9 38.4 0.5 52.4 -3.1 13 -6.5 22.6 -11.2 31.1 -15.4 27.8 -40 47.6 -67 53.9 -8.2 1.9 -24.8 1.8 -31.9 -0.1 z"
      />
      <path
        fill="#2e3f78"
        d="M 140 209.9 c -22.2 -4.6 -42.4 -18.7 -50.7 -35.3 -1.4 -2.8 -3.4 -6.1 -4.5 -7.2 -1.8 -2.1 -1.8 -2.4 -0.3 -8.9 2.5 -11.1 7.7 -19.8 15.9 -26.6 10.2 -8.6 17.3 -11.9 25.5 -11.9 23.6 0 44 -6.7 55.1 -18.1 14.6 -14.9 16.7 -35.7 5.9 -57.2 -2.4 -4.8 -2.7 -5.9 -1.4 -6.3 2.9 -1.2 8.4 2.7 17.6 12.5 14.7 15.4 23.6 32 28.6 53.2 2.3 9.7 2.7 13.7 2.7 26.9 0.1 16.9 -1 23.8 -6.5 40.8 -2.4 7.1 -3.5 9.2 -4.9 9.2 -1 0 -4.9 3.2 -8.7 7.1 -19.6 20.3 -45.2 27.8 -74.3 21.8 z"
      />
    </svg>
  );
}

export interface LogoProps {
  /** Logomark size in px; the wordmark scales from it. */
  size?: number;
  className?: string;
  /** Show the "argoniq" wordmark next to the mark. */
  showWordmark?: boolean;
  glow?: boolean;
  style?: CSSProperties;
}

export function Logo({
  size = 32,
  className,
  showWordmark = true,
  glow = true,
  style,
}: LogoProps): JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2.5 leading-none', className)} style={style}>
      <LogoMark size={size} glow={glow} />
      {showWordmark && (
        <span
          className="inline-flex items-baseline leading-none select-none"
          style={{ fontSize: size * 0.66 }}
        >
          <span style={{ color: 'currentColor', fontWeight: 360, letterSpacing: '-0.015em' }}>
            argon
          </span>
          <span
            style={{
              color: 'var(--color-brand, #1559d6)',
              fontWeight: 720,
              letterSpacing: '-0.02em',
            }}
          >
            iq
          </span>
        </span>
      )}
    </span>
  );
}
