import { type JSX } from 'react';
import { type ConfigSource } from '@argoniq/core-domain';
import { Text } from '@argoniq/ui';

/** Muted label showing where an effective-configuration value came from. */
const SOURCE_LABEL: Record<ConfigSource, string> = {
  as_built: 'As built',
  serial_master: 'Serial master',
  customer_reported: 'Company reported',
  inferred: 'Inferred',
  default: 'Model default',
};

export function ConfigSourceText({ source }: { source: ConfigSource }): JSX.Element {
  return (
    <Text as="span" size="sm" tone="muted">
      {SOURCE_LABEL[source]}
    </Text>
  );
}
