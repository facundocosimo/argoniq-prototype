import { type JSX } from 'react';
import { ShieldAlert } from 'lucide-react';
import { type ResolvedOption } from '@argoniq/core-domain';
import { Card, CardBody, CardHeader, CardTitle, StatusDot, Text } from '@argoniq/ui';

/**
 * Equipment options (configuration axis) — one generic renderer for every family,
 * driven entirely by the catalog. A boolean module reads Fitted / Not fitted; a
 * choice/quantity reads its chosen value; `safetyRelevant` surfaces a flag the
 * answer pipeline's safety gate also consumes (e.g. absent ATEX kit). No per-family
 * UI code — a new OEM family renders correctly the day it is seeded.
 */
export function EquipmentOptionsCard({
  options,
}: {
  options: readonly ResolvedOption[];
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle>Options &amp; modules</CardTitle>
          <Text size="xs" tone="subtle">
            Installed modules on this serial — present, absent, or the chosen level.
          </Text>
        </div>
      </CardHeader>
      <CardBody>
        {options.length === 0 ? (
          <Text size="sm" tone="muted">
            No options catalog is defined for this model.
          </Text>
        ) : (
          <dl className="divide-border divide-y">
            {options.map((option) => (
              <OptionRow key={option.key} option={option} />
            ))}
          </dl>
        )}
      </CardBody>
    </Card>
  );
}

function OptionStatus({ option }: { option: ResolvedOption }): JSX.Element {
  if (option.optionType === 'boolean') {
    if (option.present) return <StatusDot tone="success" label="Fitted" />;
    return <StatusDot tone={option.safetyRelevant ? 'danger' : 'neutral'} label="Not fitted" />;
  }
  // choice / quantity
  if (!option.recorded || !option.present || !option.chosenValue) {
    return <StatusDot tone="neutral" label="Not configured" />;
  }
  const value = option.unit ? `${option.chosenValue} ${option.unit}` : option.chosenValue;
  return <StatusDot tone="info" label={value} />;
}

function OptionRow({ option }: { option: ResolvedOption }): JSX.Element {
  return (
    <div className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="text-text-muted flex items-center gap-2 text-sm sm:w-56 sm:shrink-0">
        <span className="text-text">{option.label}</span>
        {option.safetyRelevant ? (
          <ShieldAlert className="text-zone-red size-3.5" aria-label="safety-relevant" />
        ) : null}
      </dt>
      <dd className="flex flex-1 items-baseline justify-between gap-4">
        <OptionStatus option={option} />
        {option.safetyRelevant ? (
          <Text as="span" size="xs" tone="subtle" className="shrink-0">
            safety-relevant
          </Text>
        ) : null}
      </dd>
    </div>
  );
}
