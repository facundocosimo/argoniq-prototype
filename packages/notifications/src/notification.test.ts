import { describe, expect, it } from 'vitest';
import { severityFromZone } from './notification.js';
import { createCollectingNotifier } from './notifier.js';

describe('severityFromZone', () => {
  it('keeps one color language across safety zones and notifications', () => {
    expect(severityFromZone('GREEN')).toBe('success');
    expect(severityFromZone('YELLOW')).toBe('warning');
    expect(severityFromZone('RED')).toBe('danger');
  });
});

describe('collecting notifier', () => {
  it('records dispatched notifications via the severity shortcuts', () => {
    const notifier = createCollectingNotifier();
    notifier.success('Case created', { href: '/cases/1' });
    notifier.danger('Ingestion failed');

    expect(notifier.sent).toHaveLength(2);
    expect(notifier.sent[0]).toMatchObject({ severity: 'success', title: 'Case created' });
    expect(notifier.sent[1]).toMatchObject({ severity: 'danger', title: 'Ingestion failed' });
  });
});
