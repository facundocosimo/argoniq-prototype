'use client';

import { type CSSProperties, type JSX, useId } from 'react';
import { IconButton, Tooltip, TooltipContent, TooltipTrigger } from '@argoniq/ui';
import { toggleTheme, useTheme } from '../lib/use-theme.js';

/**
 * Topbar theme switch. One control, one gesture: a sun that morphs into a
 * crescent moon (rays retract; a masked disc slides in to carve the crescent), while the
 * whole UI wipes to the new theme in a circle expanding from the click (`toggleTheme`).
 * Backed by the shared `useTheme` store, so it stays in sync with the user-menu toggle.
 * The icon shows the CURRENT theme; the aria-label/tooltip name the action.
 */
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

/** 8 sun rays, evenly spaced — retract into the disc when the moon takes over. */
const RAYS: readonly [number, number, number, number][] = [
  [12, 2.5, 12, 4.5],
  [17.3, 4.2, 16.2, 5.9],
  [21.5, 12, 19.5, 12],
  [17.3, 19.8, 16.2, 18.1],
  [12, 21.5, 12, 19.5],
  [6.7, 19.8, 7.8, 18.1],
  [2.5, 12, 4.5, 12],
  [6.7, 4.2, 7.8, 5.9],
];

function ThemeGlyph({ dark }: { dark: boolean }): JSX.Element {
  const maskId = useId();
  const morph = (extra: CSSProperties = {}): CSSProperties => ({
    transformBox: 'fill-box',
    transformOrigin: 'center',
    transition: `transform 600ms ${EASE}, opacity 380ms ease`,
    ...extra,
  });
  return (
    <svg viewBox="0 0 24 24" className="size-[1.15rem] overflow-visible" fill="none" aria-hidden>
      <mask id={maskId}>
        <rect width="24" height="24" fill="black" />
        <circle cx="12" cy="12" r="5.6" fill="white" />
        {/* The "biter": overlaps the disc to carve a crescent (dark), slides clear for a full sun (light). */}
        <circle
          cx="12"
          cy="12"
          r="5.6"
          fill="black"
          style={morph({ transform: dark ? 'translate(4px, -3.2px)' : 'translate(15px, 0)' })}
        />
      </mask>
      {/* Rays — the sun's corona. Scale + fade out (with a slight counter-rotate) for the moon. */}
      <g
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        style={morph({
          transform: dark ? 'scale(0.35) rotate(-45deg)' : 'scale(1) rotate(0deg)',
          opacity: dark ? 0 : 1,
        })}
      >
        {RAYS.map(([x1, y1, x2, y2]) => (
          <line key={`${x1}-${y1}`} x1={x1} y1={y1} x2={x2} y2={y2} />
        ))}
      </g>
      {/* The disc, masked into a crescent (dark) or a full sun (light). */}
      <circle cx="12" cy="12" r="5" fill="currentColor" mask={`url(#${maskId})`} />
    </svg>
  );
}

export function ThemeToggle(): JSX.Element {
  const { theme } = useTheme();
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <IconButton
          aria-label={`Switch to ${next} theme`}
          onClick={(event) => toggleTheme({ x: event.clientX, y: event.clientY })}
        >
          <ThemeGlyph dark={theme === 'dark'} />
        </IconButton>
      </TooltipTrigger>
      <TooltipContent>{`Switch to ${next} theme`}</TooltipContent>
    </Tooltip>
  );
}
