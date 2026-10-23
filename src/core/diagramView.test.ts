import { describe, expect, it } from 'vitest';
import {
  defaultDiagramView,
  layoutModuleLines,
  moduleCardHeight,
  moduleCards,
  moduleColumns,
  moduleDimmed,
  moduleEdges,
  moduleLineWidth,
  moduleStep,
  placeModules,
  prefixLine,
  representativeTables,
  MODULE_CARD_GAP_X,
  MODULE_CARD_ORIGIN_X,
  MODULE_CARD_ORIGIN_Y,
  MODULE_CARD_WIDTH,
} from './diagramView';
import { atad5sTables } from './fixtures/atad5sShape';
import { unlinkedTables } from './modules';
import type { Column, Table } from './model';

const key = (name = 'id'): Column => ({ name, type: 'INT', pk: true });
const fk = (column: string, table: string, inferred = false): Column => ({
  name: column,
  type: 'INT',
  fk: { table, column: 'id', ...(inferred ? { inferred: true } : {}) },
});
const tbl = (name: string, columns: Column[]): Table => ({ name, columns });

describe('defaultDiagramView', () => {
  it('opens a schema of more than 80 tables on Modules', () => {
    expect(defaultDiagramView(0)).toBe('tables');
    expect(defaultDiagramView(80)).toBe('tables');
    expect(defaultDiagramView(81)).toBe('modules');
    expect(defaultDiagramView(atad5sTables().length)).toBe('modules');
  });
});

describe('module cards', () => {
  const org = tbl('org', [key()]);
  const family = Array.from({ length: 16 }, (_, i) => tbl(`a_${i}`, [key(), fk('org_id', 'org')]));
  const bOne = tbl('b_one', [key(), fk('a_id', 'a_0', true)]);
  const bTwo = tbl('b_two', [key(), fk('a_id', 'a_0')]);
  const alone = tbl('loose_note', [key()]);
  const tables = [org, ...family, bOne, bTwo, alone];
  const cards = [
    { name: 'a', tables: family.map((table) => table.name) },
    { name: 'b', tables: ['b_one', 'b_two'] },
    { name: 'org', tables: ['org'] },
  ];

  it('names three tables and counts the rest', () => {
    expect(representativeTables(tables, ['b_one', 'b_two', 'a_0', 'org'])).toEqual(['org', 'a_0', 'b_one']);
    expect(prefixLine(['da_nhan_vien', 'da_phong_ban'])).toBe('da_nhan_vien* · da_phong_ban*');
  });

  it('counts every foreign key between two modules, and leaves a hub or a declared key out when asked', () => {
    expect(moduleEdges(tables, cards, { hideHubs: false, inferredOnly: false })).toEqual([
      { from: 'a', to: 'org', relationships: 16 },
      { from: 'a', to: 'b', relationships: 2 },
    ]);
    expect(moduleEdges(tables, cards, { hideHubs: true, inferredOnly: false })).toEqual([{ from: 'a', to: 'b', relationships: 2 }]);
    expect(moduleEdges(tables, cards, { hideHubs: false, inferredOnly: true })).toEqual([{ from: 'a', to: 'b', relationships: 1 }]);
    expect(moduleEdges(tables, cards, { hideHubs: true, inferredOnly: true })).toEqual([{ from: 'a', to: 'b', relationships: 1 }]);
  });

  it('fades a module that shares no line with the one selected', () => {
    const edges = moduleEdges(tables, cards, { hideHubs: false, inferredOnly: false });
    expect(moduleDimmed('a', null, edges)).toBe(false);
    expect(moduleDimmed('a', 'a', edges)).toBe(false);
    expect(moduleDimmed('org', 'a', edges)).toBe(false);
    expect(moduleDimmed('b', 'org', edges)).toBe(true);
  });

  it('leaves a table with no relationship off every card of the atad5s schema', () => {
    const schema = atad5sTables();
    const loose = new Set(unlinkedTables(schema));
    const drawn = moduleCards(schema);
    expect(drawn.length).toBeGreaterThan(1);
    for (const card of drawn) {
      expect(card.sample.length).toBeLessThanOrEqual(3);
      expect(card.sample.length + card.more).toBe(card.tables.length);
      expect(card.tables.some((name) => loose.has(name))).toBe(false);
    }
    const weight = (edges: { relationships: number }[]) => edges.reduce((sum, edge) => sum + edge.relationships, 0);
    const open = moduleEdges(schema, drawn, { hideHubs: false, inferredOnly: false });
    const hidden = moduleEdges(schema, drawn, { hideHubs: true, inferredOnly: false });
    expect(weight(open)).toBeGreaterThan(0);
    expect(weight(hidden)).toBeLessThan(weight(open));
  });
});

describe('module layout', () => {
  it('places cards 196px wide on a grid, and draws a line from middle to middle', () => {
    expect(moduleColumns(1102)).toBe(5);
    expect(moduleColumns(300)).toBe(1);
    const height = moduleCardHeight(4, true, false);
    expect(height).toBe(moduleCardHeight(10, true, false));
    expect(moduleCardHeight(4, true, true)).toBe(height + 26);
    const placed = placeModules(
      [
        { name: 'a', tables: ['a', 'b', 'c', 'd'], prefixes: ['a'] },
        { name: 'b', tables: ['e', 'f', 'g', 'h'], prefixes: ['b'] },
      ],
      2,
      null,
    );
    expect(placed[0]).toMatchObject({ x: MODULE_CARD_ORIGIN_X, y: MODULE_CARD_ORIGIN_Y, width: MODULE_CARD_WIDTH, height });
    expect(placed[1].x).toBe(MODULE_CARD_ORIGIN_X + MODULE_CARD_WIDTH + MODULE_CARD_GAP_X);
    expect(placed[1].y).toBe(placed[0].y);
    expect(moduleLineWidth(18)).toBe(5.5);
    const [line] = layoutModuleLines(placed, [{ from: 'a', to: 'b', relationships: 18 }], 'a');
    expect(line.width).toBe(5.5);
    expect(line.active).toBe(true);
    expect(line.x1).toBe(placed[0].x + MODULE_CARD_WIDTH / 2);
    expect(line.labelX).toBe((line.x1 + line.x2) / 2);
    expect(moduleStep(placed, 'a', 'right')).toBe('b');
    expect(moduleStep(placed, 'b', 'left')).toBe('a');
    expect(moduleStep(placed, 'a', 'down')).toBeNull();
  });
});
