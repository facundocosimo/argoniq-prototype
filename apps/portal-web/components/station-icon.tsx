import { type JSX, type SVGProps } from 'react';

/**
 * Curated schematic icon set, keyed by `machine_families.iconKey`. Monochrome line
 * art drawn with `currentColor` so it inherits text color and works in both themes.
 * Used by the line schematic (composition) and machine lists — distinct from the
 * colored product illustrations served for the equipment hero image. Unknown or
 * missing keys fall back to a generic module glyph.
 */
export type StationIconKey =
  'conveyor' | 'pretreatment' | 'coater' | 'cabin' | 'oven' | 'printer' | 'robot' | 'generic';

const PATHS: Record<StationIconKey, JSX.Element> = {
  conveyor: (
    <>
      <rect x="2.5" y="10.5" width="19" height="4" rx="2" />
      <circle cx="6" cy="12.5" r="1.4" />
      <circle cx="12" cy="12.5" r="1.4" />
      <circle cx="18" cy="12.5" r="1.4" />
      <path d="M9 7h6v3H9z" />
      <path d="M5 16.5v1.5M19 16.5v1.5" />
    </>
  ),
  pretreatment: (
    <>
      <rect x="3" y="8" width="18" height="9" rx="1.5" />
      <path d="M3 12h18" />
      <path d="M8 5v2M12 5v2M16 5v2" />
      <path d="M8 8l-1 2.5M8 8l1 2.5M12 8l-1 2.5M12 8l1 2.5M16 8l-1 2.5M16 8l1 2.5" />
    </>
  ),
  coater: (
    <>
      <rect x="4" y="10" width="16" height="8" rx="1.5" />
      <path d="M12 4v5" />
      <path d="M10.5 9h3l-.6 2h-1.8z" />
      <path d="M11.3 11v1.6M12 11.4v1.6M12.7 11v1.6" />
    </>
  ),
  cabin: (
    <>
      <rect x="4" y="4" width="16" height="13" rx="1.5" />
      <rect x="6.5" y="6.5" width="11" height="8" rx="1" />
      <path d="M10.5 7.5c-1.4 2-1.4 4 0 6M13.5 7.5c-1.4 2-1.4 4 0 6" />
    </>
  ),
  oven: (
    <>
      <rect x="4" y="4" width="16" height="14" rx="1.5" />
      <circle cx="12" cy="10.5" r="3.2" />
      <path d="M12 8.5v2l1.3.8" />
      <path d="M4 15.5h16" />
    </>
  ),
  printer: (
    <>
      <rect x="5" y="4" width="14" height="15" rx="1.5" />
      <rect x="7.5" y="6.5" width="9" height="6" rx="1" />
      <path d="M12 7.5v4M10 9.5h4" />
      <path d="M7.5 15h4M12.5 15h4" />
    </>
  ),
  robot: (
    <>
      <path d="M6 20v-4l3-3 2 2 3-5 4 4v6" />
      <circle cx="16" cy="5.5" r="2" />
      <path d="M6 20h13" />
    </>
  ),
  generic: (
    <>
      <rect x="4" y="5" width="16" height="14" rx="1.5" />
      <path d="M8 9h8M8 12h8M8 15h5" />
    </>
  ),
};

function resolveKey(iconKey: string | null | undefined): StationIconKey {
  return iconKey && iconKey in PATHS ? (iconKey as StationIconKey) : 'generic';
}

export function StationIcon({
  iconKey,
  ...props
}: { iconKey: string | null | undefined } & SVGProps<SVGSVGElement>): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {PATHS[resolveKey(iconKey)]}
    </svg>
  );
}
