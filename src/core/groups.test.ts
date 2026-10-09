import { describe, expect, it } from 'vitest';
import { blogMysqlDump, shopVietnameseDump } from './fixtures/sql';
import { ecommerceSnapshot } from './fixtures/testing';
import {
  assignGroup,
  copyMember,
  GROUP_COLORS,
  groupChoices,
  groupNameProblem,
  groupOf,
  groupsOf,
  newGroupName,
  nextGroupColor,
  recolorGroup,
  removeGroup,
  renameGroup,
  renameMember,
  sameGroups,
  suggestGroups,
} from './groups';
import type { Table, TableGroup } from './model';
import { mysqlParser } from './parse/mysql';

/** The tables of a MySQL dump. */
function dumped(sql: string): Table[] {
  const outcome = mysqlParser.parse(sql);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.tables;
}

/** Tables that have only their names. */
const called = (...names: string[]): Table[] => names.map((name) => ({ name, columns: [] }));

/** `orders: orders, order_items` for each suggestion. */
const listed = (tables: readonly Table[], groups?: readonly TableGroup[]) =>
  suggestGroups(tables, groups).map((s) => `${s.name}: ${s.tables.join(', ')}`);

describe('suggestGroups', () => {
  it('groups the tables of the ecommerce sample that are called after another', () => {
    expect(listed(ecommerceSnapshot().tables)).toEqual(['orders: orders, order_items']);
  });

  it('looks past what every table of a dump begins with', () => {
    expect(listed(dumped(shopVietnameseDump))).toEqual([
      'tb_san_pham: tb_san_pham_danh_muc, tb_san_pham',
      'tb_don_hang: tb_don_hang, tb_don_hang_chi_tiet, tb_don_hang_lich_su',
    ]);
    // `wp_usermeta` is one word after `wp_`: it does not begin with the word `user`.
    expect(listed(dumped(blogMysqlDump))).toEqual(['wp_terms: wp_terms, wp_term_taxonomy, wp_term_relationships']);
  });

  it('names a group after the table the others are called after, or after what they begin with', () => {
    const tables = called(
      'da_chung_tu',
      'da_chung_tu_noi_dung',
      'da_chung_tu_phe_duyet',
      'da_loai_chung_tu',
      'da_bao_cao_ngay',
      'da_bao_cao_thang',
      'da_hoa_don',
    );
    expect(listed(tables)).toEqual([
      'da_chung_tu: da_chung_tu, da_chung_tu_noi_dung, da_chung_tu_phe_duyet',
      'da_bao_cao: da_bao_cao_ngay, da_bao_cao_thang',
    ]);
    expect(listed(called('OrderItems', 'OrderLines', 'Users', 'UserRoles', 'HTTPLog'))).toEqual([
      'Order: OrderItems, OrderLines',
      'Users: Users, UserRoles',
    ]);
  });

  it('keeps the tables of a module together when the schema has several', () => {
    const tables = called('dm_kho', 'dm_khach_hang', 'dm_san_pham', 'dm_san_pham_nhom', 'ht_user', 'ht_role', 'log');
    // Two of the four `dm_` tables begin with `dm_san_pham`, which is not most of them.
    expect(listed(tables)).toEqual(['dm: dm_kho, dm_khach_hang, dm_san_pham, dm_san_pham_nhom', 'ht: ht_user, ht_role']);
  });

  it('splits a module most of whose tables are in smaller families, and groups what is left of it', () => {
    const tables = called(
      'da_chung_tu',
      'da_chung_tu_noi_dung',
      'da_de_xuat',
      'da_de_xuat_lich_su',
      'da_de_xuat_phe_duyet',
      'da_hoa_don',
      'da_invoice',
      'ht_user',
      'ht_role',
    );
    expect(listed(tables)).toEqual([
      'da_chung_tu: da_chung_tu, da_chung_tu_noi_dung',
      'da_de_xuat: da_de_xuat, da_de_xuat_lich_su, da_de_xuat_phe_duyet',
      'da: da_hoa_don, da_invoice',
      'ht: ht_user, ht_role',
    ]);
  });

  it('suggests nothing for tables whose names have nothing in common', () => {
    expect(suggestGroups(called('users', 'products', 'payments'))).toEqual([]);
    expect(suggestGroups(called('users'))).toEqual([]);
    expect(suggestGroups([])).toEqual([]);
    // Every table begins with `app`, and one is called just that.
    expect(suggestGroups(called('app', 'app_users', 'app_log'))).toEqual([]);
  });

  it('leaves out the tables that are in a group', () => {
    const tables = dumped(shopVietnameseDump);
    const own: TableGroup[] = [{ name: 'orders', color: 'violet', tables: ['tb_don_hang', 'tb_don_hang_chi_tiet'] }];
    // One table of `tb_don_hang` is left, which is no group.
    expect(listed(tables, own)).toEqual(['tb_san_pham: tb_san_pham_danh_muc, tb_san_pham']);

    // A group of the name takes the table that came after it was made.
    const made: TableGroup[] = [{ name: 'tb_don_hang', color: 'violet', tables: ['tb_don_hang', 'tb_don_hang_chi_tiet'] }];
    expect(listed(tables, made)).toEqual(['tb_san_pham: tb_san_pham_danh_muc, tb_san_pham', 'tb_don_hang: tb_don_hang_lich_su']);
    const all: TableGroup[] = [{ ...made[0], tables: [...made[0].tables, 'tb_don_hang_lich_su'] }];
    expect(listed(tables, all)).toEqual(['tb_san_pham: tb_san_pham_danh_muc, tb_san_pham']);
  });
});

describe('editing groups', () => {
  const groups: readonly TableGroup[] = Object.freeze([
    Object.freeze({ name: 'sales', color: 'violet', tables: Object.freeze(['orders', 'order_items']) as string[] }) as TableGroup,
    Object.freeze({ name: 'people', color: 'orange', tables: Object.freeze(['users']) as string[] }) as TableGroup,
  ]);

  it('reads the groups of a snapshot and of a table', () => {
    expect(groupsOf(ecommerceSnapshot())).toEqual([]);
    expect(groupsOf({ groups: [...groups] })).toEqual(groups);
    expect(groupOf(groups, 'order_items')?.name).toBe('sales');
    expect(groupOf(groups, 'payments')).toBeUndefined();
  });

  it('gives a new group the colour that is used least and a name that is free', () => {
    expect(nextGroupColor([])).toBe(GROUP_COLORS[0]);
    expect(nextGroupColor(groups)).toBe('cyan');
    const each = GROUP_COLORS.map((color, i): TableGroup => ({ name: `g${i}`, color, tables: [] }));
    expect(nextGroupColor(each)).toBe(GROUP_COLORS[0]);
    expect(nextGroupColor(each.slice(1))).toBe(GROUP_COLORS[0]);
    expect(newGroupName(groups)).toBe('group_1');
    expect(newGroupName([{ name: 'group_1', color: 'gray', tables: [] }])).toBe('group_2');
  });

  it('adds a group with the tables it is given', () => {
    const next = assignGroup(groups, ['products', 'payments', 'products'], 'catalog');
    expect(next).toEqual([...groups, { name: 'catalog', color: 'cyan', tables: ['products', 'payments'] }]);
    expect(next[0]).toBe(groups[0]);
    expect(assignGroup([], [], 'group_1', 'gray')).toEqual([{ name: 'group_1', color: 'gray', tables: [] }]);
  });

  it('moves a table from the group it was in, which stays when it is empty', () => {
    const next = assignGroup(groups, ['users', 'payments'], 'sales');
    expect(next).toEqual([
      { name: 'sales', color: 'violet', tables: ['orders', 'order_items', 'users', 'payments'] },
      { name: 'people', color: 'orange', tables: [] },
    ]);
    expect(assignGroup(groups, ['orders'], 'sales')).toBe(groups);
  });

  it('takes tables out of every group', () => {
    expect(assignGroup(groups, ['orders', 'users'], null)).toEqual([
      { name: 'sales', color: 'violet', tables: ['order_items'] },
      { name: 'people', color: 'orange', tables: [] },
    ]);
    expect(assignGroup(groups, ['payments'], null)).toBe(groups);
  });

  it('lists the tables a group is chosen from, with the ones that are in it or in another', () => {
    const { tables } = ecommerceSnapshot();
    const choices = groupChoices(tables, groups, 'sales');
    expect(choices.map((c) => c.table)).toEqual(tables.map((t) => t.name));
    expect(choices.filter((c) => c.member).map((c) => c.table)).toEqual(['orders', 'order_items']);
    expect(choices.filter((c) => c.from).map((c) => `${c.table} of ${c.from?.name}`)).toEqual(['users of people']);
    expect(choices.find((c) => c.table === 'payments')).toEqual({ table: 'payments', member: false });
    // A group that is not there yet has no table.
    expect(groupChoices(tables, groups, 'catalog').some((c) => c.member)).toBe(false);
  });

  it('filters the tables a group is chosen from by the words of their names', () => {
    const { tables } = ecommerceSnapshot();
    const shown = (filter: string) => groupChoices(tables, groups, 'sales', filter).map((c) => c.table);
    expect(shown('order')).toEqual(['orders', 'order_items']);
    expect(shown('  ITEMS order ')).toEqual(['order_items']);
    expect(shown('   ')).toEqual(tables.map((t) => t.name));
    expect(shown('nothing')).toEqual([]);
    const shop = dumped(shopVietnameseDump);
    expect(groupChoices(shop, [], 'group_1', 'don hang').map((c) => c.table)).toEqual(
      shop.map((t) => t.name).filter((n) => n.includes('don') && n.includes('hang')),
    );
    expect(groupChoices(shop, [], 'group_1', 'don hang').length).toBeGreaterThan(1);
  });

  it('removes, renames and recolours a group', () => {
    expect(removeGroup(groups, 'sales')).toEqual([groups[1]]);
    expect(removeGroup(groups, 'nothing')).toBe(groups);

    expect(renameGroup(groups, 'sales', ' selling ').map((g) => g.name)).toEqual(['selling', 'people']);
    expect(renameGroup(groups, 'sales', 'people')).toBe(groups);
    expect(renameGroup(groups, 'sales', '  ')).toBe(groups);
    expect(renameGroup(groups, 'sales', 'sales')).toBe(groups);
    expect(renameGroup(groups, 'nothing', 'x')).toBe(groups);

    expect(recolorGroup(groups, 'people', 'lime')[1]).toEqual({ name: 'people', color: 'lime', tables: ['users'] });
    expect(recolorGroup(groups, 'people', 'orange')).toBe(groups);
  });

  it('says why a group cannot have a name', () => {
    expect(groupNameProblem(groups, '')).toBe('Group name cannot be empty.');
    expect(groupNameProblem(groups, '   ')).toBe('Group name cannot be empty.');
    expect(groupNameProblem(groups, 'people')).toBe('Group "people" already exists.');
    expect(groupNameProblem(groups, 'people', 'people')).toBeNull();
    expect(groupNameProblem(groups, 'catalog')).toBeNull();
  });

  it('follows a table that is renamed, deleted or copied', () => {
    expect(renameMember(groups, 'orders', 'purchases')[0].tables).toEqual(['purchases', 'order_items']);
    expect(renameMember(groups, 'orders', null)[0].tables).toEqual(['order_items']);
    expect(renameMember(groups, 'payments', 'x')).toBe(groups);
    expect(copyMember(groups, 'orders', 'orders_copy')[0].tables).toEqual(['orders', 'orders_copy', 'order_items']);
    expect(copyMember(groups, 'payments', 'payments_copy')).toBe(groups);
  });

  it('compares groups by what they hold', () => {
    expect(sameGroups(groups, structuredClone(groups))).toBe(true);
    expect(sameGroups(groups, [])).toBe(false);
    expect(sameGroups(groups, recolorGroup(groups, 'sales', 'gray'))).toBe(false);
    expect(sameGroups(groups, renameGroup(groups, 'sales', 'selling'))).toBe(false);
    expect(sameGroups(groups, assignGroup(groups, ['users'], 'sales'))).toBe(false);
    expect(sameGroups(groups, renameMember(groups, 'orders', 'purchases'))).toBe(false);
  });
});
