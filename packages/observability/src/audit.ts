import {
  type AnswerMode,
  type ConfidenceBand,
  type DocumentId,
  type KnowledgeTier,
  type SafetyZone,
  type SerialId,
} from '@argoniq/core-domain';
import { getLogger, type Logger } from './logger.js';

/**
 * Event shapes for access checks, AI answer decisions, and safety decisions.
 * The default auditor writes structured log records with request context.
 */
export type AuditSourceRef = {
  readonly documentId?: DocumentId;
  readonly tier: KnowledgeTier;
  readonly page?: number;
};

export type AccessAuditEvent = {
  readonly kind: 'access';
  readonly action: string;
  readonly subjectType: string;
  readonly subjectId: string;
  readonly decision: 'allow' | 'deny';
  readonly reason?: string;
};

export type AiDecisionAuditEvent = {
  readonly kind: 'ai_decision';
  readonly action: 'ai.answer';
  /** Canonical symptom key, or 'UNMAPPED'. */
  readonly symptomKey: string;
  readonly serialId?: SerialId;
  readonly answerMode: AnswerMode;
  readonly safetyZone: SafetyZone;
  readonly confidence: ConfidenceBand;
  readonly sources: readonly AuditSourceRef[];
  readonly escalated: boolean;
};

export type SafetyAuditEvent = {
  readonly kind: 'safety';
  readonly action: 'safety.decision';
  readonly zone: SafetyZone;
  /** The deterministic rule that decided the zone. */
  readonly rule: string;
  readonly outcome: 'allow' | 'escalate' | 'refuse';
};

export type AuditEvent = AccessAuditEvent | AiDecisionAuditEvent | SafetyAuditEvent;

export interface Auditor {
  record(event: AuditEvent): void;
}

/** Logging auditor that emits one structured `audit` log line per event. */
export function createLoggingAuditor(logger: Logger = getLogger({ audit: true })): Auditor {
  return {
    record(event: AuditEvent): void {
      logger.info({ audit: event, at: new Date().toISOString() }, `audit:${event.kind}`);
    },
  };
}

/** No-op auditor for unit tests where the audit trail is not under test. */
export const noopAuditor: Auditor = {
  record() {
    /* intentionally empty */
  },
};
