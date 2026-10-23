import { describe, expect, it } from 'vitest';
import { atad5sTables } from './fixtures/atad5sShape';
import { ecommerceSnapshot } from './fixtures/testing';
import {
  canvasStubs,
  foldQuery,
  implicitShown,
  indexExplorer,
  markRange,
  matchesOnCanvas,
  nextShown,
  prefixBuckets,
  searchExplorer,
  shownCount,
  SHOW_ALL_BELOW,
  visibleNames,
} from './explorer';
import { isDirty } from './dirty';
import { findHubs, suggestModules } from './modules';
import type { Column, Table } from './model';

const key = (name = 'id'): Column => ({ name, type: 'INT', pk: true });
const rel = (column: string, table: string): Column => ({ name: column, type: 'INT', fk: { table, column: 'id' } });
const tbl = (name: string, columns: Column[]): Table => ({ name, columns });

describe('foldQuery and markRange', () => {
  it('matches a name with or without Vietnamese accents', () => {
    expect(foldQuery('Nguyễn')).toBe('nguyen');
    expect(foldQuery('Đơn vị')).toBe('don vi');
    const table = tbl('đơn_vị', [key(), { name: 'Mã_xưởng', type: 'INT' }]);
    const index = indexExplorer([table]);
    expect(searchExplorer(index, 'don_vi').groups.map((g) => g.tables.map((t) => t.table))).toEqual([['đơn_vị']]);
    expect(searchExplorer(index, 'Đơn_vị').matches).toBe(1);
    expect(searchExplorer(index, 'ma_xuong', 'columns').groups[0].tables[0].columns.map((c) => c.name)).toEqual(['Mã_xưởng']);
    expect(searchExplorer(index, 'Mã_xưởng', 'tables').matches).toBe(0);
    expect(markRange('đơn_vị', 'don')).toEqual({ start: 0, end: 3 });
    expect(markRange('Mã_xưởng', 'xuong')).toEqual({ start: 3, end: 8 });
  });
});

describe('shown and total', () => {
  const org = tbl('org', [key()]);
  const people = [tbl('hr_staff', [key(), rel('org_id', 'org')]), tbl('hr_role', [key(), rel('staff_id', 'hr_staff')])];
  const pay = Array.from({ length: 4 }, (_, i) => tbl(`pay_${i}`, [key(), rel('staff_id', 'hr_staff')]));
  const tables = [org, ...people, ...pay];

  it('counts how many tables of a module are on the canvas', () => {
    const modules = suggestModules(tables);
    const shown = new Set(['hr_staff', 'pay_0']);
    const hr = modules.find((m) => m.tables.includes('hr_staff'))!;
    // pay_* reference hr_staff, so they join its module: both names that are shown count.
    expect(shownCount(hr.tables, shown)).toEqual({ shown: 2, total: hr.tables.length });
    expect(shownCount(pay.map((t) => t.name), shown)).toEqual({ shown: 1, total: 4 });
    expect(shownCount(['hr_role'], new Set())).toEqual({ shown: 0, total: 1 });
  });

  it('shows every table of a small schema and only the largest module of a large one', () => {
    const small = ecommerceSnapshot().tables;
    expect(small.length).toBeLessThanOrEqual(SHOW_ALL_BELOW);
    expect(implicitShown(small, suggestModules(small))).toBeNull();
    expect(visibleNames(small, suggestModules(small), undefined)).toEqual(small.map((t) => t.name));

    const many = Array.from({ length: SHOW_ALL_BELOW + 1 }, (_, i) => tbl(i < 2 ? `keep_${i}` : `rest_${i}`, [key(), ...(i < 2 || i === 2 ? [] : [rel('keep_id', 'keep_0')])]));
    // keep_0 and keep_1 share a prefix; the rest reference keep_0 and may join it or not.
    const modules = suggestModules(many);
    const implicit = implicitShown(many, modules);
    expect(implicit).not.toBeNull();
    expect(implicit!.length).toBeLessThan(many.length);
    expect(visibleNames(many, modules, undefined)).toEqual(implicit);
    expect(nextShown(many, modules, undefined, implicit!)).toBeNull();
    expect(nextShown(many, modules, ['keep_0'], implicit!)).toBeUndefined();
  });

  it('is a change of the diagram and not of the tables', () => {
    const saved = ecommerceSnapshot();
    const hidden = { ...saved, shown: ['users'] };
    expect(isDirty(hidden, saved)).toBe(true);
    expect(isDirty(saved, saved)).toBe(false);
    expect(isDirty(hidden, hidden)).toBe(false);
  });
});

describe('stubs', () => {
  it('draws one stub for a table outside the canvas and none for a hub', () => {
    const hub = tbl('hub', [key()]);
    const outside = tbl('outside', [key()]);
    const again = tbl('again', [key()]);
    const home = [
      tbl('home_a', [key(), rel('hub_id', 'hub'), rel('out_id', 'outside'), rel('again_id', 'again')]),
      tbl('home_b', [key(), rel('out_id', 'outside'), rel('hub_id', 'hub')]),
    ];
    const pointing = Array.from({ length: 16 }, (_, i) => tbl(`ref_${i}`, [key(), rel('hub_id', 'hub')]));
    const tables = [hub, outside, again, ...home, ...pointing];
    expect(findHubs(tables).map((h) => h.table)).toEqual(['hub']);
    const modules = suggestModules(tables);
    const shown = new Set(['home_a', 'home_b']);
    const stubs = canvasStubs(tables, modules, shown);
    expect(stubs.map((s) => s.table)).toEqual(['outside', 'again']);
    expect(new Set(stubs.map((s) => s.table)).size).toBe(stubs.length);
    expect(stubs.some((s) => s.table === 'hub')).toBe(false);
  });

  it('gives the atad5s hubs no stub', () => {
    const tables = atad5sTables();
    const modules = suggestModules(tables);
    const hubs = new Set(findHubs(tables).map((h) => h.table));
    expect(hubs.has('da_don_vi')).toBe(true);
    const shown = new Set(visibleNames(tables, modules, undefined));
    const stubs = canvasStubs(tables, modules, shown, hubs);
    expect(stubs.length).toBe(new Set(stubs.map((s) => s.table)).size);
    for (const stub of stubs) {
      expect(shown.has(stub.table)).toBe(false);
      expect(hubs.has(stub.table)).toBe(false);
    }
  });
});

describe('searchExplorer', () => {
  it('groups matches by module and counts the ones already on the canvas', () => {
    const tables = [
      tbl('đơn_hàng', [key(), { name: 'mã_kho', type: 'INT', fk: { table: 'kho', column: 'id' } }]),
      tbl('kho', [key()]),
      tbl('khác', [key(), { name: 'ghi_chú', type: 'TEXT' }]),
    ];
    const index = indexExplorer(tables);
    const found = searchExplorer(index, 'ma_kho');
    expect(found.matches).toBe(1);
    expect(found.groups[0].tables[0].columns[0].references).toEqual({ table: 'kho', column: 'id' });
    expect(found.named).toBeNull();
    const byName = searchExplorer(index, 'kho');
    expect(byName.named).toBe('kho');
    expect(matchesOnCanvas(byName, new Set(['kho']))).toBe(1);
  });

  it('filters the atad5s schema in under 50 ms', () => {
    const tables = atad5sTables();
    expect(tables.length).toBeGreaterThanOrEqual(269);
    const index = indexExplorer(tables, suggestModules(tables));
    const start = performance.now();
    for (let i = 0; i < 30; i++) searchExplorer(index, i % 2 ? 'ma_to_xuong' : 'don_vi');
    expect((performance.now() - start) / 30).toBeLessThan(50);
  });
});

describe('prefixBuckets', () => {
  it('gathers unlinked tables that share a prefix and leaves the rest', () => {
    const buckets = prefixBuckets([
      'wp_actionscheduler_actions',
      'wp_actionscheduler_logs',
      'da_cai_dat',
      'da_cai_dat_phe',
      'lonely',
    ]);
    expect(buckets.map((b) => b.label)).toContain('wp_actionscheduler*');
    expect(buckets.find((b) => b.label === 'wp_actionscheduler*')?.tables).toHaveLength(2);
    expect(buckets.at(-1)?.label).toBe('');
    expect(buckets.at(-1)?.tables).toContain('lonely');
  });
});
