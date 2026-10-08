import { describe, expect, it } from 'vitest';
import { shopVietnameseDump } from '../fixtures/sql';
import { ecommerceSnapshot, inferredTables } from '../fixtures/testing';
import { addInferred } from '../infer';
import { computeEdges, edgePath, gridLayout } from '../layout';
import type { SchemaSnapshot, Table } from '../model';
import { mysqlParser } from '../parse/mysql';
import { fitText, generateDiagram, imageScale, type DiagramColors } from './diagram';

const colors: DiagramColors = {
  background: '#131416',
  node: '#1d1e22',
  nodeBorder: '#30323a',
  rule: '#232428',
  ink1: '#e7e8eb',
  ink2: '#a4a8b1',
  ink3: '#8b909a',
  pk: '#e3b341',
  fk: '#4cc2b0',
  relation: '#6b717c',
  invalid: '#ff7b72',
  groups: { violet: '#a78bfa', orange: '#f0883e', cyan: '#56c8e8', pink: '#ec7fc0', lime: '#a3c95a', brown: '#c49a6c', gray: '#9aa0ab' },
};

const count = (text: string, part: string) => text.split(part).length - 1;

/** Fails unless every tag of `svg` is closed by its own kind, in order. */
function expectWellFormed(svg: string) {
  const open: string[] = [];
  for (const [, closing, name, , selfClosing] of svg.matchAll(/<(\/?)([a-zA-Z]+)((?:"[^"]*"|[^>"])*?)(\/?)>/g)) {
    if (selfClosing) continue;
    if (closing) expect(open.pop()).toBe(name);
    else open.push(name);
  }
  expect(open).toEqual([]);
  // Nothing of a name is left to be read as markup.
  expect(svg.replace(/<[^<>]*>/g, '')).not.toMatch(/[<>]/);
}

describe('fitText', () => {
  it('cuts a text that is too long and ends it with an ellipsis', () => {
    expect(fitText('order_items', 11)).toBe('order_items');
    expect(fitText('order_items', 8)).toBe('order_i…');
    expect(fitText('order_items', 8.9)).toBe('order_i…');
    expect(fitText('order_items', 0)).toBe('…');
    expect(fitText('', 4)).toBe('');
  });
});

describe('generateDiagram', () => {
  it('draws the ecommerce sample: its tables where they are, their columns and the four relationships', () => {
    const snapshot = ecommerceSnapshot();
    const { svg, width, height } = generateDiagram(snapshot, colors, { background: true });
    expectWellFormed(svg);
    // From 24,24 to the right of order_items and the bottom of payments, with 24 around.
    expect([width, height]).toEqual([836, 519]);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="836" height="519" viewBox="0 0 836 519"');
    expect(svg).toContain('<rect x="0" y="0" width="836" height="519" fill="#131416"/>');

    // A table: its box, its name and how many columns it has.
    expect(svg).toContain('<rect x="24.5" y="48.5" width="227" height="158" rx="7.5" fill="#1d1e22" stroke="#30323a"/>');
    for (const table of snapshot.tables) expect(svg).toContain(`font-weight="600" fill="#e7e8eb">${table.name}</text>`);
    expect(count(svg, 'text-anchor="end" font-size="11"')).toBe(5);
    // A column: the name, the type at the right, and what marks it.
    const columns = snapshot.tables.reduce((sum, t) => sum + t.columns.length, 0);
    expect(count(svg, '<text')).toBe(
      5 * 2 +
        columns * 2 +
        snapshot.tables.flatMap((t) => t.columns).filter((c) => c.nullable).length +
        snapshot.tables.flatMap((t) => t.columns).filter((c) => c.unique).length,
    );
    expect(svg).toContain('fill="#e7e8eb">email</text>');
    expect(svg).toContain('text-anchor="end" fill="#a4a8b1">VARCHAR(255)</text>');
    expect(count(svg, 'stroke="#e3b341"')).toBe(5);
    expect(count(svg, 'stroke="#4cc2b0"')).toBe(4);
    expect(svg).toContain('font-size="9.5" font-weight="600" fill="#8b909a">UQ</text>');

    // The lines are the ones of the canvas, each with its two ends.
    const edges = computeEdges(snapshot.tables, snapshot.positions);
    for (const e of edges) expect(svg).toContain(`<path d="${edgePath(e.a, e.b, e.via)}"/>`);
    expect(svg).toContain('<g fill="none" stroke="#6b717c" stroke-width="1.25">');
    expect(count(svg, 'stroke-dasharray')).toBe(0);
  });

  it('is see-through without the background, and brings the fonts it is given', () => {
    const snapshot = ecommerceSnapshot();
    const plain = generateDiagram(snapshot, colors, { background: false });
    expect(plain.svg).not.toContain('fill="#131416"');
    expect(plain.svg).not.toContain('<style>');
    const css = "@font-face{font-family:'Geist Mono';src:url(data:font/woff2;base64,AAAA)}";
    const withFonts = generateDiagram(snapshot, colors, { background: false, fontCss: css });
    expect(withFonts.svg).toContain(`<style>${css}</style>`);
    expectWellFormed(withFonts.svg);
  });

  it('dashes the line of an inferred foreign key and fades its glyph', () => {
    const { positions } = ecommerceSnapshot();
    const { svg } = generateDiagram({ tables: inferredTables(), positions }, colors, { background: true });
    expect(count(svg, 'stroke-dasharray="5 4"')).toBe(4);
    expect(count(svg, 'stroke="#4cc2b0" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"')).toBe(4);
  });

  it('paints the head of a table in the colour of its group', () => {
    const snapshot: SchemaSnapshot = {
      ...ecommerceSnapshot(),
      groups: [{ name: 'sales', color: 'orange', tables: ['orders', 'order_items'] }],
    };
    const { svg } = generateDiagram(snapshot, colors, { background: true });
    expectWellFormed(svg);
    expect(count(svg, '<clipPath')).toBe(2);
    expect(count(svg, 'height="3" fill="#f0883e"')).toBe(2);
    expect(count(svg, 'fill="#f0883e" opacity="0.1"')).toBe(2);
    // orders is the second table.
    expect(svg).toContain('<clipPath id="t1"><rect x="305" y="25" width="226" height="157" rx="7"/></clipPath>');
  });

  it('cuts names and types that do not fit a row, and writes them so that they are text', () => {
    const table: Table = {
      name: 'a_table_with_a_name_that_is_far_too_long',
      schema: 'audit',
      columns: [
        { name: 'id', type: 'BIGINT UNSIGNED AUTO_INCREMENT', pk: true },
        { name: 'a_column_name_that_is_too_long', type: 'VARCHAR(255)', nullable: true },
        { name: '', type: '' },
        { name: 'a<b>&"c"', type: "ENUM('x','<y>')" },
      ],
    };
    const { svg } = generateDiagram({ tables: [table], positions: { [table.name]: { x: 0, y: 0 } } }, colors, { background: false });
    expectWellFormed(svg);
    // The schema it is in, fainter, and as much of the name as the head holds.
    expect(svg).toContain('<tspan fill="#8b909a">audit.</tspan>a_table_with_a_n…</text>');
    // `id` leaves the type most of the row; a long name leaves it six characters, one of them the `?`.
    expect(svg).toContain('>BIGINT UNSIGNED AU…</text>');
    expect(svg).toContain('>a_column_name_…</text>');
    expect(svg).toContain('>VARC…</text>');
    expect(svg).toContain('fill="#8b909a">?</text>');
    expect(svg).toContain('fill="#ff7b72" font-style="italic">unnamed</text>');
    expect(svg).toContain('>—</text>');
    expect(svg).toContain('>a&lt;b&gt;&amp;&quot;c&quot;</text>');
    expect(svg).toContain(">ENUM('x','&lt;y…</text>");
  });

  it('draws the lines that go around tables, and makes room for them', () => {
    const outcome = mysqlParser.parse(shopVietnameseDump);
    if (!outcome.ok) throw new Error(outcome.error.message);
    const tables = addInferred(outcome.tables);
    const positions = gridLayout(tables);
    const around = computeEdges(tables, positions).filter((e) => e.via);
    expect(around.length).toBeGreaterThan(0);
    const { svg, width, height } = generateDiagram({ tables, positions }, colors, { background: true });
    expectWellFormed(svg);
    for (const e of around) {
      expect(svg).toContain(`<path d="${edgePath(e.a, e.b, e.via)}" stroke-dasharray="5 4"/>`);
      for (const p of e.via!) {
        expect(p.x).toBeGreaterThanOrEqual(24);
        expect(p.y).toBeGreaterThanOrEqual(24);
        expect(p.x).toBeLessThanOrEqual(width - 24);
        expect(p.y).toBeLessThanOrEqual(height - 24);
      }
    }
  });

  it('leaves out a table that has no place, and is a small empty picture without any', () => {
    const { tables, positions } = ecommerceSnapshot();
    const one = generateDiagram({ tables, positions: { users: positions.users } }, colors, { background: true });
    expect(count(one.svg, 'font-weight="600" fill="#e7e8eb">')).toBe(1);
    expect([one.width, one.height]).toEqual([228 + 48, 159 + 48]);

    const none = generateDiagram({ tables: [], positions: {} }, colors, { background: true });
    expectWellFormed(none.svg);
    expect([none.width, none.height]).toEqual([320, 160]);
  });
});

describe('imageScale', () => {
  it('is the scale that is asked for while the picture stays within what a browser draws', () => {
    expect(imageScale(836, 519, 2)).toBe(2);
    expect(imageScale(836, 519, 1)).toBe(1);
    // 10000 px across: no more than 16384 of them.
    expect(imageScale(10000, 1000, 2)).toBe(1.63);
    // 8000 by 6000 at 2x would be 192 million px: 64 million are 1.15x.
    expect(imageScale(8000, 6000, 2)).toBe(1.15);
    expect(imageScale(30000, 20000, 2)).toBe(0.32);
    expect(imageScale(0, 0, 2)).toBe(2);
  });
});
