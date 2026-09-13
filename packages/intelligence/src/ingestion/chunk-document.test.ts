import { describe, expect, it } from 'vitest';
import { type ParsedDocument } from './ingestion-types.js';
import { chunkDocument } from './chunk-document.js';

/**
 * This deliberately simple, invented document checks that a table remains one
 * chunk and keeps its section path. The values are test tokens, not equipment
 * specifications or operating instructions.
 */

const DEMO_NETWORK_TABLE = [
  '| DEMO NETWORK | ATLAS TRAINING CELL |',
  '| --- | --- |',
  '| Demo port | PORT-A |',
  '| Cable marker | BLUE-DEMO |',
  '| Training address | 192.0.2.44 |',
  '| Profile | LAB-SANDBOX |',
].join('\n');

const fictionalGuide: ParsedDocument = {
  pageCount: 8,
  language: 'en',
  revision: { docKey: 'FICTIONAL-NETWORK', label: 'A', effectiveFrom: '2026-01-01' },
  blocks: [
    {
      kind: 'heading',
      text: 'FICTIONAL TRAINING REFERENCE',
      page: 4,
      sectionNumber: '4',
      level: 1,
    },
    { kind: 'heading', text: 'Demo Network', page: 4, sectionNumber: '4.2', level: 2 },
    {
      kind: 'paragraph',
      text: 'This invented network is used only to exercise the training interface.',
      page: 4,
    },
    {
      kind: 'list',
      text: '- Find the blue demo cable.\n- Connect it to the labelled training port.\n- Keep the sandbox disconnected from production networks.',
      page: 4,
    },
    {
      kind: 'paragraph',
      text: 'The labelled training port is on the mock control panel.',
      page: 4,
    },
    { kind: 'table', text: DEMO_NETWORK_TABLE, page: 4 },
    {
      kind: 'paragraph',
      text: 'Do not connect the fictional training profile to a production network.',
      page: 4,
    },
  ],
};

describe('chunkDocument — structure-aware, table-atomic', () => {
  const chunks = chunkDocument(fictionalGuide, { docTitle: 'Atlas Training Cell Reference' });

  it('emits the demo-network table as exactly one atomic table chunk', () => {
    const tables = chunks.filter((c) => c.chunkType === 'table');
    expect(tables).toHaveLength(1);
    const table = tables[0]!;
    expect(table.content).toContain('DEMO NETWORK');
    expect(table.content).toContain('Training address');
    expect(table.content).toContain('192.0.2.44');
    expect(table.content).toContain('LAB-SANDBOX');
  });

  it('cites the table by its own section path, on the right page', () => {
    const table = chunks.find((c) => c.chunkType === 'table')!;
    expect(table.sectionPath).toBe('4.2');
    expect(table.sectionTitle).toBe('Demo Network');
    expect(table.page).toBe(4);
  });

  it('never merges the table with the surrounding prose', () => {
    const table = chunks.find((c) => c.chunkType === 'table')!;
    expect(table.content).not.toContain('production network');
    const caveat = chunks.find((c) => c.content.includes('production network'));
    expect(caveat?.chunkType).toBe('prose');
    expect(caveat?.sectionPath).toBe('4.2');
  });

  it('prepends a deterministic contextual breadcrumb before embedding', () => {
    const table = chunks.find((c) => c.chunkType === 'table')!;
    expect(
      table.contextualText.startsWith('Atlas Training Cell Reference — section 4.2 Demo Network'),
    ).toBe(true);
    expect(table.contextualText).toContain('Training address');
  });

  it('assigns blocks to the most specific heading', () => {
    const intro = chunks.find((c) => c.content.includes('exercise the training interface'))!;
    expect(intro.sectionPath).toBe('4.2');
  });

  it('numbers chunks sequentially from zero', () => {
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });
});

describe('chunkDocument — prose budgeting within a section', () => {
  it('splits long prose at the budget but keeps the same section path', () => {
    const long = 'x'.repeat(300);
    const doc: ParsedDocument = {
      pageCount: 1,
      language: 'en',
      blocks: [
        { kind: 'heading', text: 'General', page: 1, sectionNumber: '5.1', level: 2 },
        ...Array.from({ length: 6 }, (_, i) => ({
          kind: 'paragraph' as const,
          text: `${long}-${i}`,
          page: 1,
        })),
      ],
    };
    const chunks = chunkDocument(doc, { docTitle: 'Doc', maxChars: 500 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.sectionPath === '5.1')).toBe(true);
  });
});
