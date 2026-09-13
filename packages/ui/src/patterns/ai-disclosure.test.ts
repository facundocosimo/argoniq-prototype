import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AI_DISCLOSURE_STATEMENT, AiDisclosure } from './ai-disclosure.js';

/**
 * The AI-interaction disclosure is a compliance control (EU AI Act Art. 50(1)):
 * the surface MUST inform users they are interacting with an AI system. These tests
 * lock that guarantee — the required statement is present, non-empty, and actually
 * rendered by the component — so it can never be silently removed or emptied. Real
 * render via `react-dom/server` (no DOM env needed).
 */
describe('AI disclosure (AI Act Art. 50(1))', () => {
  it('states plainly that the user is interacting with an AI system', () => {
    expect(AI_DISCLOSURE_STATEMENT.toLowerCase()).toContain('ai system');
    expect(AI_DISCLOSURE_STATEMENT.length).toBeGreaterThan(0);
  });

  it('renders the required statement as an accessible note', () => {
    const html = renderToStaticMarkup(createElement(AiDisclosure));
    expect(html).toContain(AI_DISCLOSURE_STATEMENT);
    expect(html).toContain('role="note"');
    // Honest context is present, not just the bare statement.
    expect(html).toMatch(/cites its sources|safety|service case/);
  });

  it('weaves the OEM/provider name when given', () => {
    const html = renderToStaticMarkup(
      createElement(AiDisclosure, { providerName: 'Acme Additive' }),
    );
    expect(html).toContain('Acme Additive');
  });
  it('retains the AI disclosure in the compact chat presentation', () => {
    const html = renderToStaticMarkup(createElement(AiDisclosure, { compact: true }));
    expect(html).toContain(AI_DISCLOSURE_STATEMENT);
    expect(html).toContain('role="note"');
    expect(html).toContain('Check sources before acting.');
  });
});
