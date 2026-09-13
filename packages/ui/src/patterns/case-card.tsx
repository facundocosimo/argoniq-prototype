import { forwardRef, type HTMLAttributes } from 'react';
import { type SafetyZone } from '@argoniq/core-domain';
import { cn } from '../lib/cn.js';
import { Card, CardBody, CardHeader, CardTitle } from '../primitives/card.js';
import { Text } from '../primitives/typography.js';
import { Inline, Stack } from '../primitives/layout.js';
import { SafetyZoneIndicator } from './safety-zone-indicator.js';

/**
 * CaseCard. The customer-facing view of a Mode-E
 * escalation: a plain-language summary, the deterministic SafetyZone, an inline
 * priority (typographic, never a pill), and bounded "until someone arrives" steps.
 * It shows ONLY customer-safe content — ranked causes, numeric confidences, and the
 * Mode-D internal note are staff-facing and never rendered here.
 */
export type CasePriority = 'P1' | 'P2' | 'P3' | 'P4';

const PRIORITY_LABEL: Record<CasePriority, string> = {
  P1: 'P1 · Critical',
  P2: 'P2 · High',
  P3: 'P3 · Normal',
  P4: 'P4 · Low',
};

const PRIORITY_TEXT: Record<CasePriority, string> = {
  P1: 'text-zone-red',
  P2: 'text-zone-amber',
  P3: 'text-text-muted',
  P4: 'text-text-subtle',
};

export type CaseCardView = {
  reference?: string;
  summary: string;
  zone: SafetyZone;
  priority?: CasePriority;
  /** Bounded, customer-safe holding actions (never a RED procedure). */
  nextSteps?: readonly string[];
};

export type CaseCardProps = HTMLAttributes<HTMLDivElement> & { serviceCase: CaseCardView };

export const CaseCard = forwardRef<HTMLDivElement, CaseCardProps>(function CaseCard(
  { serviceCase, className, ...props },
  ref,
) {
  return (
    <Card ref={ref} className={className} {...props}>
      <CardHeader>
        <Inline justify="between" align="center" wrap>
          <div className="flex flex-col gap-0.5">
            <CardTitle>Support request opened</CardTitle>
            {serviceCase.reference ? (
              <Text size="xs" tone="subtle" className="nums-tabular">
                Reference {serviceCase.reference}
              </Text>
            ) : null}
          </div>
          {serviceCase.priority ? (
            <span className={cn('text-xs font-medium', PRIORITY_TEXT[serviceCase.priority])}>
              {PRIORITY_LABEL[serviceCase.priority]}
            </span>
          ) : null}
        </Inline>
      </CardHeader>
      <CardBody>
        <Stack gap={3}>
          <SafetyZoneIndicator zone={serviceCase.zone} />
          <Text size="sm">{serviceCase.summary}</Text>
          {serviceCase.nextSteps && serviceCase.nextSteps.length > 0 ? (
            <div>
              <Text size="xs" tone="subtle" className="mb-1.5">
                Until someone arrives
              </Text>
              <ul className="flex list-disc flex-col gap-1 pl-4">
                {serviceCase.nextSteps.map((step) => (
                  <li key={step} className="text-text-muted text-sm">
                    {step}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Stack>
      </CardBody>
    </Card>
  );
});
