import { subject as caslSubject } from '@casl/ability';
import {
  type KnowledgeTier,
  isCustomerCitable,
  roleCanSeeTier,
  roleSpaceOf,
} from '@argoniq/core-domain';
import { type Auditor, ForbiddenError } from '@argoniq/observability';
import { type Action, type AppAbility, type SubjectType, defineAbilityFor } from './ability.js';
import { type Actor } from './actor.js';

/** Subject attributes used for fine-grained checks (e.g. a Document's tier/customer). */
export type SubjectAttributes = Record<string, unknown>;

/**
 * The policy engine handed to every service via the ServiceContext. `can` is the
 * silent check; `assertCan` throws `ForbiddenError` and audits the decision —
 * services call `assertCan` right after validating input (validate → authorize →
 * act → audit).
 */
export interface PolicyEngine {
  readonly actor: Actor;
  readonly ability: AppAbility;
  can(action: Action, subjectType: SubjectType, attributes?: SubjectAttributes): boolean;
  assertCan(action: Action, subjectType: SubjectType, attributes?: SubjectAttributes): void;
}

export function createPolicyEngine(actor: Actor, auditor?: Auditor): PolicyEngine {
  const ability = defineAbilityFor(actor);

  const can = (
    action: Action,
    subjectType: SubjectType,
    attributes?: SubjectAttributes,
  ): boolean =>
    attributes
      ? ability.can(action, caslSubject(subjectType, attributes))
      : ability.can(action, subjectType);

  return {
    actor,
    ability,
    can,
    assertCan(action, subjectType, attributes): void {
      const allowed = can(action, subjectType, attributes);
      const subjectId = attributes && typeof attributes.id === 'string' ? attributes.id : 'n/a';
      auditor?.record({
        kind: 'access',
        action: `${subjectType}.${action}`,
        subjectType,
        subjectId,
        decision: allowed ? 'allow' : 'deny',
      });
      if (!allowed) throw new ForbiddenError();
    },
  };
}

/**
 * Coarse, role-level tier ceiling — "may the AI ever surface this tier to this
 * actor?". Companies are capped at citable tiers (T1/T2) regardless of anything
 * else; staff per their role ceiling. Per-document scope (T2 customer match) is
 * the finer `can('read', 'Document', { ... })` check.
 */
export function canSurfaceTierToActor(actor: Actor, tier: KnowledgeTier): boolean {
  if (roleSpaceOf(actor.role) === 'customer') return isCustomerCitable(tier);
  return roleCanSeeTier(actor.role, tier);
}

/** May this actor's reasoning use internal (T3) knowledge? (Staff only.) */
export function canViewInternalKnowledge(actor: Actor): boolean {
  return defineAbilityFor(actor).can('view_internal', 'Document');
}

/** May this actor trigger fleet-learning prior updates? (Manager/admin only.) */
export function canRunFleetLearning(actor: Actor): boolean {
  return defineAbilityFor(actor).can('run_fleet_learning', 'Fleet');
}
