import {
  BookText,
  Boxes,
  Building2,
  ClipboardList,
  Layers,
  MapPin,
  Network,
  Users,
  Workflow,
} from 'lucide-react';
import type { AppAbility } from '@argoniq/auth/ability';
import { type Role, roleSpaceOf } from '@argoniq/core-domain';
import { type NavGroup } from '@argoniq/ui';
import { routes } from './routes.js';

/** Shared category definitions; each experience orders the same destinations. */
export const NAV: NavGroup[] = [
  {
    key: 'workspace',
    items: [
      { key: 'cases', label: 'Cases', href: routes.cases, icon: ClipboardList },
      {
        key: 'machines',
        label: 'Machines',
        href: routes.machines,
        icon: Boxes,
        children: [
          {
            key: 'models',
            label: 'Models',
            href: routes.manage.models,
            icon: Layers,
            oemOnly: true,
          },
          {
            key: 'lines',
            label: 'Lines',
            href: routes.manage.lines,
            icon: Workflow,
            oemOnly: true,
          },
        ],
      },
      {
        key: 'companies',
        label: 'Companies',
        href: routes.manage.companies,
        icon: Building2,
        oemOnly: true,
        children: [
          { key: 'contacts', label: 'Contacts', href: routes.manage.contacts, icon: Users },
          { key: 'sites', label: 'Sites', href: routes.manage.sites, icon: MapPin },
        ],
      },
      {
        key: 'documents',
        label: 'Documents',
        href: routes.manage.documents,
        icon: BookText,
        oemOnly: true,
        children: [
          { key: 'coverage', label: 'Coverage', href: routes.manage.documentsCoverage },
          { key: 'preview', label: 'Assistant preview', href: routes.manage.documentsResolve },
        ],
      },
    ],
  },
];

export function workspaceNav(role: Role, ability: AppAbility | null): NavGroup[] {
  const customer = roleSpaceOf(role) === 'customer';
  const items = NAV.flatMap((group) => group.items).map((item) => {
    if (item.key === 'documents' && ability?.can('create', 'Document'))
      return {
        ...item,
        create: {
          key: 'upload-document',
          label: 'Upload document',
          href: `${routes.manage.documents}/upload`,
        },
      };
    if (item.key === 'companies' && ability?.can('create', 'Company'))
      return {
        ...item,
        create: {
          key: 'new-company',
          label: 'New company',
          href: `${routes.manage.companies}/new`,
        },
      };
    if (item.key === 'machines' && ability?.can('create', 'Serial'))
      return {
        ...item,
        create: { key: 'new-machine', label: 'New machine', href: `${routes.manage.machines}/new` },
      };
    if (item.key === 'cases')
      return {
        ...item,
        label: customer ? 'Support requests' : 'Cases',
        ...(ability?.can('create', 'Case')
          ? {
              create: {
                key: 'new-case',
                label: customer ? 'New support request' : 'New case',
                href: `${routes.cases}/new`,
              },
            }
          : {}),
      };
    return item;
  });
  const order = customer
    ? ['machines', 'cases']
    : role === 'admin'
      ? ['companies', 'machines', 'cases', 'documents']
      : ['cases', 'machines', 'companies', 'documents'];
  return [
    { key: 'workspace', items: order.flatMap((key) => items.filter((item) => item.key === key)) },
  ];
}

/** Login and the account-menu home action use the first category of the experience. */
export function workspaceHome(role: Role): string {
  return workspaceNav(role, null)[0]?.items[0]?.href ?? routes.machines;
}

export const PLATFORM_NAV: NavGroup[] = [
  {
    key: 'platform',
    items: [{ key: 'manufacturers', label: 'Manufacturers', href: '/platform', icon: Network }],
  },
];
export const DEFAULT_TENANT_NAME = 'ArgonIQ';
