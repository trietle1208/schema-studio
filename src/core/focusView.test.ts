import { describe, expect, it } from 'vitest';
import { atad5sTables } from './fixtures/atad5sShape';
import {
  focusColumnY,
  focusDepth,
  focusGraph,
  focusLines,
  focusNodeHeight,
  focusPath,
  focusRelations,
  focusStats,
  focusViewName,
  matchTableName,
  pathVia,
  placeFocus,
  suggestTables,
  upsertSavedView,
  fitFocus,
  FOCUS_CENTER_WIDTH,
  FOCUS_GAP_MIN,
  FOCUS_GAP_X,
  FOCUS_NODE_WIDTH,
  FOCUS_ZOOM_MIN,
  type FocusOptions,
} from './focusView';
import type { Column, Table } from './model';
import { suggestModules } from './modules';

const key = (name = 'id'): Column => ({ name, type: 'INT', pk: true });
const plain = (name: string, type = 'TEXT'): Column => ({ name, type });
const rel = (column: string, table: string): Column => ({ name: column, type: 'INT', fk: { table, column: 'id' } });
const tbl = (name: string, columns: Column[]): Table => ({ name, columns });

const view = (over: Partial<FocusOptions> = {}): FocusOptions => ({
  depth: 1,
  expanded: new Set(),
  revealed: new Set(),
  hubsAsTags: true,
  keysOnly: false,
  ...over,
});

const chain = [
  tbl('a', [key(), rel('b_id', 'b'), plain('note')]),
  tbl('b', [key(), rel('c_id', 'c'), plain('name')]),
  tbl('c', [key(), plain('title')]),
  tbl('d', [key(), rel('a_id', 'a')]),
  tbl('e', [key(), rel('b_id', 'b')]),
];

describe('focusGraph', () => {
  it('puts the table in the middle, what references it on the left and what it references on the right', () => {
    const graph = focusGraph(chain, 'a', [], view());
    expect(graph).not.toBeNull();
    const lane = new Map(graph!.nodes.map((node) => [node.table, node.lane]));
    expect(lane.get('a')).toBe(0);
    expect(lane.get('d')).toBe(-1);
    expect(lane.get('b')).toBe(1);
    expect(lane.has('c')).toBe(false);
    expect(lane.has('e')).toBe(false);
    expect(graph!.nodes.find((node) => node.table === 'b')?.hidden).toBe(2);
    expect(graph!.edges.map((edge) => edge.fromColumn).sort()).toEqual(['a_id', 'b_id']);
  });

  it('opens a second step, and a badge draws the neighbours it counts', () => {
    const two = focusGraph(chain, 'a', [], view({ depth: 2 }));
    expect(two!.nodes.find((node) => node.table === 'c')?.lane).toBe(2);
    expect(two!.nodes.some((node) => node.table === 'e')).toBe(false);

    const opened = focusGraph(chain, 'a', [], view({ expanded: new Set(['b']) }));
    const lanes = new Map(opened!.nodes.map((node) => [node.table, node.lane]));
    expect(lanes.get('c')).toBe(2);
    expect(lanes.get('e')).toBe(2);
    expect(opened!.nodes.find((node) => node.table === 'b')?.hidden).toBe(0);
  });

  it('draws a hub as a tag until it is shown', () => {
    const hub = tbl('hub', [key()]);
    const many = Array.from({ length: 15 }, (_, index) => tbl(`ref_${index}`, [key(), rel('hub_id', 'hub')]));
    const center = tbl('pay', [key(), rel('hub_id', 'hub'), rel('ref_0', 'ref_0'), plain('amount')]);
    const tables = [hub, center, ...many];
    const tagged = focusGraph(tables, 'pay', [], view());
    expect(tagged!.nodes.some((node) => node.table === 'hub')).toBe(false);
    expect(tagged!.nodes.find((node) => node.table === 'pay')?.columns.find((column) => column.name === 'hub_id')?.hub).toBe('hub');
    expect(tagged!.edges.some((edge) => edge.to === 'hub')).toBe(false);

    const shown = focusGraph(tables, 'pay', [], view({ revealed: new Set(['hub']) }));
    expect(shown!.nodes.some((node) => node.table === 'hub')).toBe(true);
    expect(shown!.edges.some((edge) => edge.to === 'hub')).toBe(true);
    expect(shown!.nodes.find((node) => node.table === 'pay')?.columns.find((column) => column.name === 'hub_id')?.hub).toBeUndefined();
  });

  it('leaves plain columns out of a card that shows keys only', () => {
    const graph = focusGraph(chain, 'a', [], view({ keysOnly: true }));
    const columns = graph!.nodes.find((node) => node.table === 'a')!.columns;
    expect(columns.some((column) => column.kind === 'plain')).toBe(false);
    expect(columns.map((column) => column.name)).toEqual(['id', 'b_id']);
  });

  it('places the left column left of the centre and joins the rows with a curve', () => {
    const graph = focusGraph(chain, 'a', [], view())!;
    const placed = placeFocus(graph.nodes);
    const at = new Map(placed.nodes.map((node) => [node.table, node]));
    expect(at.get('d')!.x + FOCUS_NODE_WIDTH).toBeLessThan(at.get('a')!.x);
    expect(at.get('a')!.x + FOCUS_CENTER_WIDTH).toBeLessThan(at.get('b')!.x);
    expect(at.get('a')!.width).toBe(FOCUS_CENTER_WIDTH);
    const lines = focusLines(placed.nodes, graph.edges);
    expect(lines).toHaveLength(2);
    const toB = lines.find((line) => line.key.startsWith('a.b_id'));
    expect(toB?.d.startsWith(`M${at.get('a')!.x + FOCUS_CENTER_WIDTH} `)).toBe(true);
    expect(focusColumnY(at.get('a')!, 'missing')).toBeLessThan(focusColumnY(at.get('a')!, 'b_id'));
    for (const node of placed.nodes) {
      for (const other of placed.nodes) {
        if (node === other) continue;
        const overlap =
          node.x < other.x + other.width &&
          other.x < node.x + node.width &&
          node.y < other.y + other.height &&
          other.y < node.y + node.height;
        expect(overlap).toBe(false);
      }
    }
    expect(focusNodeHeight(2, 1)).toBeGreaterThan(focusNodeHeight(2, 0));
  });

  it('matches the payment neighbourhood of the atad5s schema', () => {
    const tables = atad5sTables();
    const modules = suggestModules(tables);
    const graph = focusGraph(tables, 'da_thanh_toan', modules, view())!;
    const lane = new Map(graph.nodes.map((node) => [node.table, node.lane]));
    expect(lane.get('da_thanh_toan')).toBe(0);
    expect(lane.get('da_hoa_don')).toBe(-1);
    expect(lane.get('da_loai_chi')).toBe(1);
    // A hub is a tag on the column, not a card, until it is shown.
    expect(lane.has('da_don_vi')).toBe(false);
    expect(lane.has('da_to_xuong')).toBe(false);
    const center = graph.nodes.find((node) => node.table === 'da_thanh_toan');
    expect(center?.columns.some((column) => column.hub === 'da_don_vi')).toBe(true);
    expect(center?.columns.some((column) => column.hub === 'da_to_xuong')).toBe(true);

    const shown = focusGraph(tables, 'da_thanh_toan', modules, view({ revealed: new Set(['da_to_xuong']) }))!;
    expect(shown.nodes.find((node) => node.table === 'da_to_xuong')).toMatchObject({ lane: 1, hidden: 15 });
    expect(focusViewName(modules, 'da_thanh_toan')).toBe('da_thanh_toan');
    expect(focusViewName([], 'da_thanh_toan')).toBe('da_thanh_toan');
  });
});

describe('fitFocus', () => {
  const tables = atad5sTables();
  const modules = suggestModules(tables);
  const payment = (depth = 1) => focusGraph(tables, 'da_thanh_toan', modules, view({ depth }))!;

  /** What the stage takes of the canvas once it is laid out and zoomed. */
  const taken = (graph: ReturnType<typeof payment>, available: number) => {
    const fit = fitFocus(graph.nodes, available);
    return { fit, width: placeFocus(graph.nodes, fit.gap).width * fit.zoom };
  };

  it('keeps the layout it had in a canvas with room, and when the canvas is not measured yet', () => {
    const graph = payment();
    expect(fitFocus(graph.nodes, 900)).toEqual({ gap: FOCUS_GAP_X, zoom: 1 });
    expect(fitFocus(graph.nodes, 0)).toEqual({ gap: FOCUS_GAP_X, zoom: 1 });
    expect(placeFocus(graph.nodes).width).toBe(placeFocus(graph.nodes, FOCUS_GAP_X).width);
  });

  it('closes the gap between the columns before it zooms', () => {
    const graph = payment();
    // 1440px with the Explorer (300), the rail (48) and the inspector (352) leaves 740: 796px did not fit.
    const { fit, width } = taken(graph, 740);
    expect(fit.zoom).toBe(1);
    expect(fit.gap).toBeLessThan(FOCUS_GAP_X);
    expect(fit.gap).toBeGreaterThanOrEqual(FOCUS_GAP_MIN);
    expect(width).toBeLessThanOrEqual(740);
  });

  it('then zooms out, but never below 70%', () => {
    const graph = payment();
    const narrow = taken(graph, 600);
    expect(narrow.fit.gap).toBe(FOCUS_GAP_MIN);
    expect(narrow.fit.zoom).toBeLessThan(1);
    expect(narrow.fit.zoom).toBeGreaterThanOrEqual(FOCUS_ZOOM_MIN);
    expect(narrow.width).toBeLessThanOrEqual(600);
    // Too narrow even at 70%: the canvas scrolls rather than the cards shrinking further.
    expect(fitFocus(graph.nodes, 300)).toEqual({ gap: FOCUS_GAP_MIN, zoom: FOCUS_ZOOM_MIN });
  });

  it('leaves no column covered at the widths of a 1440 and a 1280 window', () => {
    const graph = payment();
    const columns = new Set(graph.nodes.map((node) => node.lane)).size;
    expect(columns).toBe(3);
    // The window less the rail, the Explorer and an inspector of 352 or 440.
    for (const available of [740, 652, 580, 510]) {
      const { fit } = taken(graph, available);
      const placed = placeFocus(graph.nodes, fit.gap);
      const right = Math.max(...placed.nodes.map((node) => node.x + node.width));
      expect((right + 20) * fit.zoom).toBeLessThanOrEqual(available + 0.5);
    }
  });

  it('lays out the lanes of a deeper view the same way', () => {
    const graph = payment(2);
    const { fit } = taken(graph, 740);
    expect(fit.gap).toBeGreaterThanOrEqual(FOCUS_GAP_MIN);
    expect(fit.zoom).toBeGreaterThanOrEqual(FOCUS_ZOOM_MIN);
  });
});

describe('focus inspector', () => {
  it('counts the foreign keys and the tables two steps away', () => {
    expect(focusStats(chain, 'a')).toEqual({ refsOut: 1, refsIn: 1, twoHop: 3 });
    expect(focusStats(chain, 'missing')).toEqual({ refsOut: 0, refsIn: 0, twoHop: 0 });
    const rows = focusRelations(chain, 'a');
    expect(rows.map((row) => row.key)).toEqual(['out:b_id', 'in:d.a_id']);
    expect(rows[0]).toMatchObject({ other: 'b', direction: 'out', hub: false });
  });

  it('reads a path and the table a name asks for', () => {
    const path = focusPath(chain, 'a', 'c');
    expect(path?.tables).toEqual(['a', 'b', 'c']);
    expect(pathVia(path!)).toBe('b_id, c_id');
    expect(focusPath(chain, 'a', 'zzz')).toBeNull();
    expect(matchTableName(chain, '  C ')).toBe('c');
    expect(matchTableName(chain, 'b_')).toBeNull();
    expect(suggestTables(chain, 'b')).toEqual(['b']);
    expect(focusDepth(0)).toBe(1);
    expect(focusDepth(2)).toBe(2);
    expect(focusDepth(9)).toBe(3);
  });

  it('replaces a saved view of the same name and keeps its id', () => {
    const first = { id: '1', name: 'Pay', tables: ['a'] };
    const added = upsertSavedView([first], { id: '2', name: 'Other', tables: ['b'] });
    expect(added.map((view) => view.name)).toEqual(['Pay', 'Other']);
    const replaced = upsertSavedView(added, { id: '9', name: 'Pay', tables: ['a', 'b'] });
    expect(replaced.find((view) => view.name === 'Pay')).toEqual({ id: '1', name: 'Pay', tables: ['a', 'b'] });
  });
});
