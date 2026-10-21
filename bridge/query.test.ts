import { describe, expect, it } from 'vitest';
import { boundedSelect, mysqlSelectSql, selectOf, tablesOf } from './query.ts';

const users = { name: 'users', columns: ['id', 'email'] };
const orders = { name: 'orders', columns: ['id', 'user_id', 'status'] };

const select = {
  cols: null,
  table: 'users',
  joins: [{ type: 'INNER', table: 'orders', on: { t: 'cmp', op: '=', l: { t: 'col', qual: 'orders', name: 'user_id' }, r: { t: 'col', qual: 'users', name: 'id' } } }],
  where: { t: 'cmp', op: '=', l: { t: 'col', qual: 'orders', name: 'status' }, r: { t: 'lit', kind: 'str', v: 'paid' } },
  order: [{ col: { t: 'col', name: 'id', qual: 'users' }, dir: 'DESC' }],
  limit: 100,
  offset: null,
};

describe('mysqlSelectSql', () => {
  it('quotes names, keeps literals as parameters, and aliases a column two tables share', () => {
    const query = selectOf(select);
    expect(query).not.toBeNull();
    expect(mysqlSelectSql(query!, [users, orders])).toEqual({
      sql: 'SELECT `users`.`id` AS `users.id`, `users`.`email` AS `email`, `orders`.`id` AS `orders.id`, `orders`.`user_id` AS `user_id`, `orders`.`status` AS `status` FROM `users` INNER JOIN `orders` ON `orders`.`user_id` = `users`.`id` WHERE `orders`.`status` = ? ORDER BY `users`.`id` DESC LIMIT ?',
      params: ['paid', 100],
    });
  });

  it('uses LIKE BINARY for a case-sensitive LIKE and LIKE for ILIKE', () => {
    const query = selectOf({
      cols: [{ t: 'col', name: 'email' }],
      table: 'users',
      where: { t: 'like', ci: false, neg: false, l: { t: 'col', name: 'email' }, r: { t: 'lit', kind: 'str', v: 'A%' } },
      order: [],
      limit: null,
      offset: null,
    });
    expect(mysqlSelectSql(query!, [users])?.sql).toBe('SELECT `email` AS `email` FROM `users` WHERE `email` LIKE BINARY ?');
    const ci = selectOf({ ...query, where: { ...query!.where, t: 'like', ci: true, neg: true, l: { t: 'col', name: 'email' }, r: { t: 'lit', kind: 'str', v: 'a%' } } });
    expect(mysqlSelectSql(ci!, [users])?.sql).toContain('NOT LIKE ?');
  });

  it('refuses a name that could change the statement, and a star with no column list', () => {
    expect(mysqlSelectSql(selectOf({ ...select, table: 'users;drop' })!, [])).toBeNull();
    expect(selectOf({ ...select, table: 'users', joins: [{ type: 'FULL', table: 'orders', on: select.joins[0].on }] })).toBeNull();
    expect(mysqlSelectSql(selectOf({ cols: null, table: 'users', where: null, order: [], limit: 10, offset: 0 })!, [])).toBeNull();
    expect(tablesOf([{ name: 'users', columns: ['id'] }])).toEqual([{ name: 'users', columns: ['id'] }]);
  });

  it('reads one extra row when the query asks for more than 1,000', () => {
    const query = selectOf({ cols: [{ t: 'col', name: 'id' }], table: 'users', where: null, order: [], limit: null, offset: 5 })!;
    expect(boundedSelect(query)).toMatchObject({ probe: true, query: { limit: 1001 } });
    expect(boundedSelect({ ...query, limit: 50 }).probe).toBe(false);
  });
});
