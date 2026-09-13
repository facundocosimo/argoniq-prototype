import { type ComponentType } from 'react';
import { type Role, roleCanSeeTier, roleSpaceOf, type KnowledgeTier } from '@argoniq/core-domain';

/**
 * Sidebar navigation model. The sidebar is *role-aware* — it only
 * shows what the user may access. Visibility is expressed as the minimum
 * KnowledgeTier the item touches; we reuse the same core-domain role→tier ceiling
 * (`roleCanSeeTier`) rather than inventing a parallel rule. Fine-grained access
 * (which serial/document) stays with the policy engine; this is only the coarse
 * nav surface.
 */
export type NavItem = {
  /** Stable key for React + active matching. */
  key: string;
  label: string;
  href: string;
  /** Lucide-style icon component (size controlled by the shell). */
  icon?: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  /**
   * Optional trailing count (e.g. open service cases). Rendered as a quiet,
   * tabular right-aligned number — never a loud pill. Omit for no badge.
   */
  badge?: number;
  /**
   * Minimum knowledge tier this destination surfaces. If set, the item is hidden
   * unless the role's ceiling reaches it. Omit for items everyone in-scope sees.
   */
  minTier?: KnowledgeTier;
  /**
   * OEM-staff-only destination (e.g. installed-base management). Hidden from every
   * customer-space role. This is a coarse nav gate for hygiene; the surface's route
   * guard and the service policy engine are the real access controls.
   */
  oemOnly?: boolean;
  /**
   * Optional sub-navigation. Renders as an indented, expandable group under this item
   * (the section auto-expands when the item or one of its children is active). Use for
   * a destination with a few sibling views — e.g. a library's Library / Coverage /
   * Preview lenses — instead of in-page tabs. One level deep only.
   */
  children?: NavItem[];
  /** Category-owned creation; the app includes it only when authorized. */
  create?: NavItem;
  /** Actual records opened in this category, scoped by the app to this user/workspace. */
  recent?: NavItem[];
};

export type NavGroup = {
  key: string;
  /** Optional section heading (e.g. "Support", "Governance"). */
  label?: string;
  items: NavItem[];
};

/** Filter a nav model down to what `role` may see, dropping empty groups. */
export function visibleNav(groups: NavGroup[], role: Role): NavGroup[] {
  const isStaff = roleSpaceOf(role) === 'oem_staff';
  const canSee = (item: NavItem): boolean =>
    (!item.oemOnly || isStaff) &&
    (item.minTier === undefined || roleCanSeeTier(role, item.minTier));
  const filterItem = (item: NavItem): NavItem =>
    // Recurse into children (a child may carry its own gate); keep the item either
    // way — a visible parent with no visible children just renders as a plain link.
    item.children ? { ...item, children: item.children.filter(canSee).map(filterItem) } : item;
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(canSee).map(filterItem),
    }))
    .filter((group) => group.items.length > 0);
}
