import { describe, expect, it } from 'vitest';
import { visibleNav, type NavGroup } from './nav.js';

const nav: NavGroup[] = [
  {
    key: 'support',
    label: 'Support',
    items: [
      { key: 'cases', label: 'Cases', href: '/cases' },
      { key: 'bulletins', label: 'Internal bulletins', href: '/bulletins', minTier: 'T3' },
    ],
  },
  {
    key: 'governance',
    label: 'Governance',
    items: [{ key: 'review', label: 'Review queue', href: '/review', minTier: 'T4' }],
  },
  {
    key: 'admin',
    label: 'Administration',
    items: [{ key: 'manage', label: 'Installed base', href: '/manage', oemOnly: true }],
  },
];

describe('visibleNav', () => {
  it('hides items above a customer operator’s tier ceiling, OEM-only items, and empty groups', () => {
    const visible = visibleNav(nav, 'operator');
    expect(visible).toHaveLength(1);
    expect(visible[0]?.key).toBe('support');
    expect(visible[0]?.items.map((i) => i.key)).toEqual(['cases']);
  });

  it('shows T3 items + the OEM-only admin group to a support technician, still hiding T4', () => {
    const visible = visibleNav(nav, 'support_technician');
    expect(visible.map((g) => g.key)).toEqual(['support', 'admin']);
    expect(visible[0]?.items.map((i) => i.key)).toEqual(['cases', 'bulletins']);
  });

  it('shows everything (including T4 + OEM-only) to an admin', () => {
    const visible = visibleNav(nav, 'admin');
    expect(visible.map((g) => g.key)).toEqual(['support', 'governance', 'admin']);
  });

  it('recurses into children: filters a gated child but keeps its visible parent', () => {
    const nested: NavGroup[] = [
      {
        key: 'lib',
        items: [
          {
            key: 'library',
            label: 'Library',
            href: '/library',
            children: [
              { key: 'all', label: 'All', href: '/library' },
              {
                key: 'restricted',
                label: 'Restricted',
                href: '/library/restricted',
                minTier: 'T4',
              },
            ],
          },
        ],
      },
    ];
    const asTech = visibleNav(nested, 'support_technician');
    // Parent stays; the T4 child is dropped for the technician (ceiling below T4).
    expect(asTech[0]?.items[0]?.children?.map((c) => c.key)).toEqual(['all']);
    const asAdmin = visibleNav(nested, 'admin');
    expect(asAdmin[0]?.items[0]?.children?.map((c) => c.key)).toEqual(['all', 'restricted']);
  });
});
