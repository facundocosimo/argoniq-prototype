import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import {
  KNOWLEDGE_TIERS,
  type KnowledgeTier,
  roleCanSeeTier,
  roleSpaceOf,
} from '@argoniq/core-domain';
import { type Actor } from './actor.js';

/**
 * The authorization model. one engine; the same rules decide
 * what a user may see and what the AI may surface to them. Default-deny: an
 * ability starts empty and only `can` rules grant access.
 *
 * `view_internal` is the T3 reasoning grant (staff only): it lets a principal's
 * answers *reason over* internal knowledge — the customer-facing channel still
 * excludes T3 structurally (that is the two-channel design, not an authz rule).
 */
export const ACTIONS = [
  'read',
  'create',
  'update',
  'delete',
  'manage',
  'view_internal',
  'publish',
  'run_fleet_learning',
] as const;
export type Action = (typeof ACTIONS)[number];

export const SUBJECT_TYPES = [
  'Tenant',
  'Company',
  'Site',
  'Contact',
  'Serial',
  // The product/type catalog (families, models, variant axes, option defs). One
  // subject for the whole Type layer: it is tenant-scoped configuration with a single
  // authorization rule — every OEM staffer may read it (form pickers + browsing);
  // only tenant admins (`manage all`) may author it.
  'Catalog',
  'Document',
  'Symptom',
  'Playbook',
  'Case',
  'Fleet',
  'all',
] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

/**
 * The CASL ability. Subjects are intentionally typed loosely at the CASL layer
 * (string subject types + runtime condition objects); compile-time safety lives
 * one level up, in the `PolicyEngine.can/assertCan` signature, which constrains
 * callers to the `Action`/`SubjectType` unions. This avoids CASL's class-subject
 * field-typing machinery while keeping the call sites type-checked.
 */
export type AppAbility = MongoAbility;

function visibleTiers(role: Actor['role']): KnowledgeTier[] {
  return KNOWLEDGE_TIERS.filter((tier) => roleCanSeeTier(role, tier));
}

/**
 * Build the ability for an actor. Tenant isolation is enforced separately by RLS
 *; these rules are the within-tenant, tier-aware, customer-scoped layer.
 */
export function defineAbilityFor(actor: Actor): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  const tiers = visibleTiers(actor.role);

  if (roleSpaceOf(actor.role) === 'oem_staff') {
    can('read', ['Serial', 'Company', 'Site', 'Contact', 'Symptom', 'Playbook', 'Case']);
    // Every OEM staffer may READ the product catalog — it backs the serial-create form
    // pickers and the Catalog Studio browse surface. Authoring it (create/update/delete)
    // is granted only to admins/support-managers below, via `manage all`.
    can('read', 'Catalog');
    can('read', 'Document', { tier: { $in: tiers } });
    can(['create', 'update'], 'Case');

    if (tiers.includes('T3')) {
      can('view_internal', 'Document', { tier: { $in: tiers } });
    }
    if (
      actor.role === 'admin' ||
      actor.role === 'support_manager' ||
      actor.role === 'documentation'
    ) {
      can('publish', 'Playbook');
      can(['create', 'update', 'delete'], 'Document');
    }
    if (actor.role === 'admin' || actor.role === 'support_manager') {
      // Full authority within the tenant (still bounded by RLS to this tenant).
      can('manage', 'all');
      can('run_fleet_learning', 'Fleet');
    }
  } else {
    // Company space: scoped to the actor's own customer; only citable tiers.
    const ownCompany = { companyId: actor.companyId };
    can('read', 'Serial', ownCompany);
    // The client may label their OWN machines with a factory tag. This is a
    // deliberately narrow write, scoped by companyId; the ONLY serial mutation that
    // asserts `update` with a companyId is `setSerialCustomerTag`. The OEM management
    // path asserts `update` with just an id, so this rule never widens it.
    can('update', 'Serial', ownCompany);
    can('read', 'Site', ownCompany);
    can('read', 'Contact', ownCompany);
    can('read', 'Case', ownCompany);
    can('create', 'Case', ownCompany);
    can('read', 'Document', { tier: 'T1' });
    can('read', 'Document', { tier: 'T2', companyId: actor.companyId });
    // Companies can never reason over internal knowledge. Explicit, though default-deny.
    cannot('view_internal', 'all');
  }

  return build();
}
