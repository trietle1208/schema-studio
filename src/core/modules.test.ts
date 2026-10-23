import { describe, expect, it } from 'vitest';
import { atad5sTables } from './fixtures/atad5sShape';
import { ecommerceSnapshot } from './fixtures/testing';
import { assignGroup, groupOf } from './groups';
import { findHubs, moduleGroup, neighbourhood, shortestPath, suggestModules, unlinkedTables } from './modules';
import type { Column, Table } from './model';

const key = (name = 'id'): Column => ({ name, type: 'INT', pk: true });
const rel = (column: string, table: string, to = 'id'): Column => ({ name: column, type: 'INT', fk: { table, column: to } });
const tbl = (name: string, columns: Column[]): Table => ({ name, columns });

describe('hubs and unlinked tables', () => {
  it('counts a table as a hub once more others reference it than the threshold', () => {
    const org = tbl('org', [key()]);
    const pointing = (n: number, at: string) => Array.from({ length: n }, (_, i) => tbl(`${at}_${i}`, [key(), rel('org_id', 'org')]));
    const fifteen = [org, ...pointing(15, 'edge')];
    expect(findHubs(fifteen)).toEqual([]);
    expect(findHubs([...fifteen, ...pointing(1, 'over')])).toEqual([{ table: 'org', referencedBy: 16 }]);
    expect(findHubs([org, ...pointing(15, 'edge'), ...pointing(16, 'over')], 14)).toEqual([{ table: 'org', referencedBy: 31 }]);
    // A reference to itself is a relationship, and it does not make a hub.
    const self = tbl('node', [key(), rel('parent_id', 'node')]);
    expect(findHubs([self])).toEqual([]);
    expect(unlinkedTables([self])).toEqual([]);
    expect(unlinkedTables([org, ...pointing(1, 'edge')])).toEqual([]);
    expect(unlinkedTables([tbl('alone', [key()])])).toEqual(['alone']);
  });

  it('finds the hubs and the tables with no relationship in the atad5s schema', () => {
    const tables = atad5sTables();
    expect(findHubs(tables)).toEqual([
      { table: 'da_don_vi', referencedBy: 67 },
      { table: 'da_to_xuong', referencedBy: 16 },
    ]);
    expect(findHubs(tables, 16).map((hub) => hub.table)).toEqual(['da_don_vi']);
    const loose = unlinkedTables(tables);
    expect(loose).toHaveLength(124);
    expect(loose).toContain('da_email');
    expect(loose).toContain('da_cham_cong');
    expect(loose).not.toContain('da_nhan_vien');
    expect(loose).not.toContain('wp_gfc_entries');
  });
});

describe('suggestModules', () => {
  it('joins the ecommerce sample into the orders module, and that module saves as a group', () => {
    const tables = ecommerceSnapshot().tables;
    const [orders, ...rest] = suggestModules(tables);
    expect(rest).toEqual([]);
    expect(orders.name).toBe('orders');
    expect(orders.prefixes).toEqual(['orders']);
    expect(orders.tables).toEqual(tables.map((table) => table.name));
    expect(orders.links).toEqual([]);
    const groups = assignGroup([], orders.tables, orders.name, moduleGroup(orders, 'violet').color);
    expect(groupOf(groups, 'order_items')).toEqual(moduleGroup(orders, 'violet'));
  });

  it('dissolves a prefix that is only what was left over, and joins groups the keys between them tie together', () => {
    const named = [
      tbl('da_orders', [key()]),
      tbl('da_orders_line', [key(), rel('order_id', 'da_orders')]),
      tbl('da_invoice', [key()]),
      tbl('da_invoice_line', [key(), rel('invoice_id', 'da_invoice')]),
      tbl('da_alpha', [key()]),
      tbl('da_beta', [key()]),
      tbl('wp_posts', [key()]),
      tbl('wp_postmeta', [key(), rel('post_id', 'wp_posts')]),
    ];
    const modules = suggestModules(named);
    expect(modules.map((m) => m.name).sort()).toEqual(['da_invoice', 'da_orders', 'wp']);
    expect(modules.find((m) => m.name === 'wp')?.tables).toEqual(['wp_posts', 'wp_postmeta']);
    expect(modules.some((m) => m.tables.includes('da_alpha'))).toBe(false);

    const joined = suggestModules([
      tbl('hr_staff', [key()]),
      tbl('hr_staff_role', [key(), rel('staff_id', 'hr_staff')]),
      tbl('hr_team', [key(), rel('staff_id', 'hr_staff'), rel('lead_id', 'hr_staff')]),
      tbl('hr_team_member', [key(), rel('team_id', 'hr_team'), rel('staff_id', 'hr_staff_role')]),
    ]);
    expect(joined).toHaveLength(1);
    expect(joined[0].prefixes).toEqual(['hr_staff', 'hr_team']);
    expect(joined[0].tables).toEqual(['hr_staff', 'hr_staff_role', 'hr_team', 'hr_team_member']);
  });

  it('does not join a domain to a catalog or through a hub', () => {
    const catalog = tbl('cat_kind', [key()]);
    const pair = (name: string) => [tbl(name, [key(), rel('kind_id', 'cat_kind')]), tbl(`${name}_line`, [key(), rel('owner_id', name)])];
    const tables = [catalog, ...pair('pay_bill'), ...pair('trip_plan'), ...pair('hr_post')];
    const modules = suggestModules(tables);
    expect(modules.map((m) => m.name).sort()).toEqual(['hr_post', 'pay_bill', 'trip_plan']);
    expect(modules.every((m) => !m.tables.includes('cat_kind'))).toBe(true);

    const org = tbl('org', [key()]);
    const refs = Array.from({ length: 16 }, (_, i) => tbl(`ref_${i}`, [key(), rel('org_id', 'org')]));
    const family = [tbl('aa_item', [key()]), tbl('aa_item_row', [key(), rel('item_id', 'aa_item'), rel('org_id', 'org')])];
    const wide = suggestModules([org, ...refs, ...family]);
    expect(findHubs([org, ...refs, ...family]).map((hub) => hub.table)).toEqual(['org']);
    expect(wide.find((m) => m.tables.includes('aa_item'))?.tables).toEqual(['aa_item', 'aa_item_row']);
  });

  it('keeps the atad5s prefix families, joins the ones the keys tie, and leaves the hub as its own', () => {
    const tables = atad5sTables();
    const modules = suggestModules(tables);
    const names = new Set<string>();
    for (const module of modules) {
      expect(module.tables.length).toBeGreaterThan(1);
      expect(module.prefixes.length).toBeGreaterThan(0);
      for (const table of module.tables) {
        expect(names.has(table)).toBe(false);
        names.add(table);
      }
      for (const link of module.links) {
        const other = modules.find((m) => m.name === link.module);
        expect(other?.links.find((item) => item.module === module.name)?.relationships).toBe(link.relationships);
      }
    }
    expect(modules.some((m) => m.name === 'da')).toBe(false);

    const pay = modules.find((m) => m.name === 'da_thanh_toan');
    expect(pay?.tables).toEqual([
      'da_hoa_don',
      'da_thanh_toan',
      'da_thanh_toan_chi_tien',
      'da_thanh_toan_phe_duyet',
      'da_thanh_toan_phe_duyet_chi',
    ]);
    expect(pay?.links.find((link) => link.module === 'da_don_vi')?.relationships).toBe(1);
    expect(modules.find((m) => m.name === 'da_loai')?.tables).not.toContain('da_thanh_toan');

    const trip = modules.find((m) => m.tables.includes('da_cong_tac'));
    expect(trip?.prefixes).toEqual(expect.arrayContaining(['da_cong_tac', 'da_dinh_muc']));
    expect(trip?.name).not.toBe('da_loai');

    const wp = modules.find((m) => m.name === 'wp');
    expect(wp?.tables).toContain('wp_users');
    expect(wp?.tables).toContain('wp_posts');
    expect(wp?.tables).not.toContain('da_thanh_toan');

    // A name family stays a module when its tables have no keys; it is still unlinked.
    expect(modules.find((m) => m.name === 'da_cham_cong')?.tables).toContain('da_cham_cong');
    expect(modules.find((m) => m.name === 'da_don_vi')?.tables).toEqual(['da_don_vi', 'da_don_vi_thong_ke']);
    expect(modules.find((m) => m.tables.includes('da_nhan_vien'))?.name).not.toBe('da_thanh_toan');
  });
});

describe('neighbourhood', () => {
  const tables = [
    tbl('a', [key(), rel('b_id', 'b')]),
    tbl('b', [key(), rel('c_id', 'c')]),
    tbl('c', [key()]),
    tbl('d', [key(), rel('a_id', 'a')]),
    tbl('e', [key(), rel('b_id', 'b')]),
  ];

  it('walks incoming and outgoing apart, and counts the neighbours still hidden', () => {
    expect(neighbourhood(tables, 'missing', 2)).toEqual([]);
    expect(neighbourhood(tables, 'a', 0)).toEqual([{ table: 'a', incoming: 0, outgoing: 0, hidden: 2 }]);

    const one = neighbourhood(tables, 'a', 1);
    expect(one.map((n) => n.table)).toEqual(['a', 'b', 'd']);
    expect(one.find((n) => n.table === 'b')).toEqual({ table: 'b', incoming: null, outgoing: 1, hidden: 2 });
    expect(one.find((n) => n.table === 'd')).toEqual({ table: 'd', incoming: 1, outgoing: null, hidden: 0 });

    const two = neighbourhood(tables, 'a', 2);
    expect(two.map((n) => n.table)).toEqual(['a', 'b', 'c', 'd']);
    expect(two.find((n) => n.table === 'c')).toMatchObject({ outgoing: 2, incoming: null });
    expect(two.find((n) => n.table === 'b')?.hidden).toBe(1);
    expect(two.some((n) => n.table === 'e')).toBe(false);
  });

  it('badges the atad5s neighbours of a payment that the depth does not open', () => {
    const tables = atad5sTables();
    const near = neighbourhood(tables, 'da_thanh_toan', 1);
    expect(near[0]).toMatchObject({ table: 'da_thanh_toan', incoming: 0, outgoing: 0, hidden: 0 });
    expect(near.find((n) => n.table === 'da_hoa_don')).toMatchObject({ incoming: 1, outgoing: null });
    expect(near.find((n) => n.table === 'da_don_vi')).toMatchObject({ outgoing: 1, incoming: null, hidden: 65 });
    expect(near.find((n) => n.table === 'da_to_xuong')?.hidden).toBe(15);
    expect(near.some((n) => n.table === 'da_nhan_vien')).toBe(false);
    expect(neighbourhood(tables, 'da_thanh_toan', 2).find((n) => n.table === 'da_don_vi')?.hidden).toBe(65);
  });
});

describe('shortestPath', () => {
  const tables = [
    tbl('a', [key(), rel('b_id', 'b'), rel('b_code', 'b'), rel('x_id', 'x')]),
    tbl('b', [key(), rel('z_id', 'z')]),
    tbl('c', [key(), rel('z_id', 'z')]),
    tbl('x', [key(), rel('z_id', 'z')]),
    tbl('z', [key()]),
    tbl('lone', [key()]),
  ];

  it('finds the shortest way from both ends, with the column and the direction of each step', () => {
    expect(shortestPath(tables, 'a', 'nope')).toBeNull();
    expect(shortestPath(tables, 'a', 'lone')).toBeNull();
    expect(shortestPath(tables, 'a', 'a')).toEqual({ tables: ['a'], hops: [] });

    expect(shortestPath(tables, 'a', 'z')).toEqual({
      tables: ['a', 'b', 'z'],
      hops: [
        { from: 'a', to: 'b', column: 'b_id', referenced: 'id', direction: 'out' },
        { from: 'b', to: 'z', column: 'z_id', referenced: 'id', direction: 'out' },
      ],
    });
    expect(shortestPath(tables, 'z', 'a')).toEqual({
      tables: ['z', 'b', 'a'],
      hops: [
        { from: 'z', to: 'b', column: 'z_id', referenced: 'id', direction: 'in' },
        { from: 'b', to: 'a', column: 'b_id', referenced: 'id', direction: 'in' },
      ],
    });
  });

  it('walks the atad5s keys from a payment to an employee through the hub', () => {
    expect(shortestPath(atad5sTables(), 'da_thanh_toan', 'da_nhan_vien')).toEqual({
      tables: ['da_thanh_toan', 'da_don_vi', 'da_nhan_vien'],
      hops: [
        { from: 'da_thanh_toan', to: 'da_don_vi', column: 'ma_don_vi', referenced: 'ma_don_vi', direction: 'out' },
        { from: 'da_don_vi', to: 'da_nhan_vien', column: 'ma_don_vi', referenced: 'ma_don_vi', direction: 'in' },
      ],
    });
  });
});
