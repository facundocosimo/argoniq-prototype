import { type Role } from '@argoniq/core-domain';

/**
 * Optional development-only persona registry. The ids match the fictional local
 * fixture in `tools/dev/sample-fixture.ts`. Real sessions remain the default.
 */

const TRAINING_TENANT = 'a1000000-0000-4000-8000-000000000001';
const TRAINING_CUSTOMER = 'a1000000-0000-4000-8000-000000000002';

export const PLATFORM_USER_ID = '00000000-0000-4000-8000-0000000d0000';
const TRAINING_OPERATOR = 'a1000000-0000-4000-8000-000000000008';
const TRAINING_ADMIN = 'a1000000-0000-4000-8000-000000000009';

export type PersonaPrincipalSpec =
  | { readonly kind: 'platform' }
  | {
      readonly kind: 'tenant';
      readonly userId: string;
      readonly tenantId: string;
      readonly role: Role;
      readonly companyId?: string;
    };

export interface Persona {
  readonly key: string;
  /** Grouping header in the switcher (the level: platform, or which OEM). */
  readonly group: string;
  /** Human role label; customer personas identify their own company explicitly. */
  readonly roleLabel: string;
  readonly principal: PersonaPrincipalSpec;
}

export const PERSONAS: readonly Persona[] = [
  {
    key: 'platform',
    group: 'ArgonIQ Platform',
    roleLabel: 'Platform operator',
    principal: { kind: 'platform' },
  },
  {
    key: 'training-admin',
    group: 'ArgonIQ Training OEM (fictional)',
    roleLabel: 'Manufacturer administrator',
    principal: { kind: 'tenant', userId: TRAINING_ADMIN, tenantId: TRAINING_TENANT, role: 'admin' },
  },
  {
    key: 'training-operator',
    group: 'ArgonIQ Training OEM (fictional)',
    roleLabel: 'Example Components (fictional) · Customer operator',
    principal: {
      kind: 'tenant',
      userId: TRAINING_OPERATOR,
      tenantId: TRAINING_TENANT,
      role: 'operator',
      companyId: TRAINING_CUSTOMER,
    },
  },
];

export const DEFAULT_PERSONA_KEY = 'platform';

export function getPersona(key: string | undefined): Persona {
  return PERSONAS.find((p) => p.key === key) ?? PERSONAS[0]!;
}
