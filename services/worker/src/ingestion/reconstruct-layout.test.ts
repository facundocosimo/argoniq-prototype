import { describe, expect, it } from 'vitest';
import { type TextItemLite, reconstructBlocks } from './reconstruct-layout.js';

/** Verifies geometry-to-structure heuristics with a wholly invented page. */

function item(str: string, x: number, y: number, width: number): TextItemLite {
  return { str, x, y, width, height: 10 };
}

// Two-column rows at x≈60 (label) and x≈300 (value); wide gap ⇒ column boundary.
const rows: [string, string][] = [
  ['DEMO NETWORK', 'ATLAS TRAINING CELL'],
  ['Demo port', 'PORT-A'],
  ['Cable marker', 'BLUE-DEMO'],
  ['Training address', '192.0.2.44'],
  ['Profile', 'LAB-SANDBOX'],
];

const items: TextItemLite[] = [
  item('4.2', 60, 700, 20),
  item('Demo Network', 90, 700, 200),
  item('This invented network exists only for software training.', 60, 680, 400),
  ...rows.flatMap(([label, value], r) => [
    item(label, 60, 640 - r * 20, 110),
    item(value, 300, 640 - r * 20, 220),
  ]),
];

describe('reconstructBlocks', () => {
  const blocks = reconstructBlocks(items, { page: 4 });

  it('detects the numbered heading and strips the number into sectionNumber', () => {
    const heading = blocks.find((b) => b.kind === 'heading');
    expect(heading?.sectionNumber).toBe('4.2');
    expect(heading?.text).toBe('Demo Network');
  });

  it('reconstructs the 2-column run into one markdown table with all cells', () => {
    const table = blocks.find((b) => b.kind === 'table');
    expect(table).toBeDefined();
    expect(table!.text).toContain('| DEMO NETWORK | ATLAS TRAINING CELL |');
    expect(table!.text).toContain('Training address');
    expect(table!.text).toContain('192.0.2.44');
    expect(table!.text).toContain('LAB-SANDBOX');
    // Reconstructed tables are flagged lower-confidence for the gated vision check.
    expect(table!.confidence).toBeLessThan(0.7);
  });

  it('keeps the intro line as a paragraph, separate from the table', () => {
    const para = blocks.find((b) => b.kind === 'paragraph');
    expect(para?.text).toContain('software training');
  });
});
