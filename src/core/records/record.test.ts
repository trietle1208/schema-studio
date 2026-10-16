import { afterEach, describe, expect, it } from 'vitest';
import { ecommerceTables } from '../fixtures/ecommerce';
import { blogMysqlDump, ecommerceMysqlDump } from '../fixtures/sql';
import { DEFAULT_LOCALE, setLocale } from '../i18n';
import type { Column, Table } from '../model';
import { parserFor } from '../parse';
import { compositeKeys, fieldMeta, validMoment, type RecordData } from './fields';
import { completeRecord, duplicateValues, fromJson, initialValues, jsonNotes, labelColumn, mergeRecord, readRecordJson, recordJson, recordLabel, relatedOf, rowKey, rowsJson, toRecord, typeLine } from './record';
import { validateRecord } from './validate';
import { seedRecords, type Row } from '.';

afterEach(() => setLocale(DEFAULT_LOCALE));

const table = (name: string) => ecommerceTables.find((x) => x.name === name)!;
const data: RecordData = seedRecords(ecommerceTables, 1);
const metas = (t: Table, rows: readonly Row[] = data[t.name]) => t.columns.map((c) => fieldMeta(c, rows, data));
const col = (type: string, rest: Partial<Column> = {}): Column => ({ name: 'c', type, nullable: false, ...rest });

describe('fieldMeta', () => {
  it('tells how each column of the sample is set', () => {
    expect(metas(table('users')).map((m) => m.kind)).toEqual(['generated', 'text', 'text', 'longtext', 'time']);
    expect(metas(table('orders')).map((m) => m.kind)).toEqual(['generated', 'reference', 'enum', 'number', 'time']);
    expect(metas(table('payments')).map((m) => m.kind)).toEqual(['generated', 'reference', 'text', 'number', 'time']);
  });

  it('offers what a status column holds, and its default, but not the values of a type it does not know', () => {
    const status = metas(table('orders'))[2];
    expect(status).toMatchObject({ kind: 'enum', fixed: false });
    if (status.kind !== 'enum') throw new Error('not an enum');
    expect(status.options).toContain('pending');
    expect(fieldMeta(col('VARCHAR(20)', { name: 'status', default: "'new'" }), [])).toEqual({ kind: 'enum', options: ['new'], fixed: false });
    expect(fieldMeta(col('VARCHAR(20)', { name: 'status' }), [])).toEqual({ kind: 'text' });
  });

  it('knows enums, json, booleans and the three moments', () => {
    expect(fieldMeta(col("ENUM('a','it''s')"), [])).toEqual({ kind: 'enum', options: ['a', "it's"], fixed: true });
    expect(fieldMeta(col('JSONB'), []).kind).toBe('json');
    expect(fieldMeta(col('BOOLEAN'), []).kind).toBe('boolean');
    expect(fieldMeta(col('DATE'), [])).toEqual({ kind: 'time', moment: 'date' });
    expect(fieldMeta(col('TIME'), [])).toEqual({ kind: 'time', moment: 'time' });
    expect(fieldMeta(col('TIMESTAMPTZ'), [])).toEqual({ kind: 'time', moment: 'timestamp' });
    expect(fieldMeta(col('INT', { default: 'AUTO_INCREMENT' }), []).kind).toBe('generated');
  });

  it('does not offer a picker for a foreign key to a table without rows', () => {
    const orders = table('orders');
    expect(fieldMeta(orders.columns[1], [], { users: [] }).kind).toBe('reference');
    expect(fieldMeta(orders.columns[1], [], {}).kind).toBe('number');
  });
});

describe('validMoment', () => {
  it('refuses a day or a time that is not on the clock', () => {
    expect(validMoment('timestamp', '2025-02-28 23:59:59')).toBe(true);
    expect(validMoment('timestamp', '2025-02-29 10:00:00')).toBe(false);
    expect(validMoment('timestamp', '2024-02-29 10:00:00')).toBe(true);
    expect(validMoment('timestamp', '2025-01-01 24:00:00')).toBe(false);
    expect(validMoment('date', '2025-13-01')).toBe(false);
    expect(validMoment('time', '12:60:00')).toBe(false);
    expect(validMoment('time', '12:00')).toBe(false);
  });
});

describe('validateRecord', () => {
  const users = table('users');
  const orders = table('orders');
  const valid = { email: 'new@example.com', name: 'New Person', avatar_url: null, created_at: '2025-03-04 10:15:00' };

  it('accepts every row of the sample, and the sample of the dumps', () => {
    for (const t of ecommerceTables) {
      for (const row of data[t.name]) expect(validateRecord(t, row, { mode: 'edit', data, record: row }), `${t.name} ${JSON.stringify(row)}`).toEqual({});
    }
    for (const [engine, sql] of [['MySQL', ecommerceMysqlDump], ['MySQL', blogMysqlDump]] as const) {
      const out = parserFor(engine)!.parse(sql);
      if (!out.ok) throw new Error(out.error.message);
      const all = seedRecords(out.tables, 3);
      for (const t of out.tables) for (const row of all[t.name]) expect(validateRecord(t, row, { data: all, record: row }), t.name).toEqual({});
    }
  });

  it('accepts a new record that leaves out what the database fills in', () => {
    expect(validateRecord(users, valid, { mode: 'new', data })).toEqual({});
    expect(validateRecord(users, { email: 'a@b.co' }, { mode: 'new', data })).toEqual({});
  });

  it('tells a column that is empty and required, by its name', () => {
    expect(validateRecord(users, { ...valid, email: '' }, { mode: 'new', data }).email).toBe('Column "email" cannot be empty.');
    expect(validateRecord(users, { name: 'x' }, { mode: 'new', data }).email).toBe('Column "email" cannot be empty.');
    expect(validateRecord(users, { ...valid, email: null }, { mode: 'edit', data }).email).toBe('Column "email" cannot be empty.');
    expect(validateRecord(users, { ...valid, name: '' }, { mode: 'new', data })).toEqual({});
    expect(validateRecord(users, { ...valid, avatar_url: '   ' }, { mode: 'new', data })).toEqual({});
  });

  it('checks numbers, decimals, truth, moments, length and emails', () => {
    const base = { user_id: data.users[0].id, status: 'pending', total: 10, created_at: '2025-03-04 10:15:00' };
    const check = (patch: Record<string, unknown>) => validateRecord(orders, { ...base, ...patch } as never, { mode: 'new', data });
    expect(check({ total: 'abc' }).total).toBe('Value must be a number.');
    expect(check({ total: '12.345' }).total).toBe('Value has more than 2 decimal places.');
    expect(check({ total: '12.5' })).toEqual({});
    expect(check({ created_at: '2025-02-30 10:00:00' }).created_at).toBe('Invalid timestamp format.');
    expect(check({ user_id: 1.5 }).user_id).toBe('Value must be a whole number.');
    expect(check({ status: 'x'.repeat(51) }).status).toBe('Value is longer than 50 characters.');
    expect(validateRecord(users, { ...valid, email: 'nobody' }, { mode: 'new', data }).email).toBe('Invalid email format.');
    expect(validateRecord(users, { ...valid, email: 'a'.repeat(251) + '@x.io' }, { mode: 'new', data }).email).toBe('Value is longer than 255 characters.');

    const flag = col('BOOLEAN', { name: 'active' });
    const t: Table = { name: 't', columns: [flag] };
    expect(validateRecord(t, { active: 'yes' }, {}).active).toBe('Value must be true or false.');
    expect(validateRecord(t, { active: false }, {})).toEqual({});
    const kind: Table = { name: 't', columns: [col("ENUM('pending','paid')", { name: 'kind' })] };
    expect(validateRecord(kind, { kind: 'lost' }, {}).kind).toBe('Value must be one of pending, paid.');
    const doc: Table = { name: 't', columns: [col('JSON', { name: 'doc' })] };
    expect(validateRecord(doc, { doc: '{\n"a": 1,\n"b": }' }, {}).doc).toBe('Invalid JSON near line 3.');
    expect(validateRecord(doc, { doc: '{"a": 1}' }, {})).toEqual({});
  });

  it('checks a foreign key against the rows that exist', () => {
    const base = { user_id: 999999, status: 'pending', total: 10, created_at: '2025-03-04 10:15:00' };
    expect(validateRecord(orders, base, { mode: 'new', data }).user_id).toBe('No row in users has id 999999.');
    expect(validateRecord(orders, base, { mode: 'new' }).user_id).toBeUndefined();
  });

  it('holds a unique key to one row, except the record itself and NULL', () => {
    const taken = data.users[2];
    const clash = validateRecord(users, { ...valid, email: taken.email }, { mode: 'new', data });
    expect(clash.email).toBe(`A row with email "${taken.email}" already exists.`);
    expect(validateRecord(users, { ...taken }, { mode: 'edit', data, record: taken })).toEqual({});
    expect(validateRecord(users, { ...taken }, { mode: 'edit', data, record: data.users[3] }).email).toBeDefined();
    const sku = validateRecord(table('products'), { name: 'p', sku: data.products[0].sku, price: 1 }, { mode: 'new', data });
    expect(sku.sku).toContain('already exists');
  });

  it('holds a key of several columns to one row, told on its last column', () => {
    const items: Table = {
      ...table('order_items'),
      indexes: [...(table('order_items').indexes ?? []), { name: 'order_items_pair', type: 'UNIQUE', using: 'btree', columns: ['order_id', 'product_id'] }],
    };
    const taken = data.order_items[0];
    const again = { order_id: taken.order_id, product_id: taken.product_id, quantity: 1, price: 5 };
    const rows = data.order_items;
    const clash = validateRecord(items, again, { mode: 'new', rows, data });
    expect(clash).toEqual({ product_id: `A row with order_id "${taken.order_id}", product_id "${taken.product_id}" already exists.` });
    // The row itself, another product, and a NULL in the key never clash.
    expect(validateRecord(items, { ...taken }, { mode: 'edit', rows, data, record: taken })).toEqual({});
    const other = data.products.find((p) => p.id !== taken.product_id)!;
    expect(validateRecord(items, { ...again, product_id: other.id }, { mode: 'new', rows: rows.filter((r) => r === taken), data })).toEqual({});
    expect(validateRecord(items, { ...again, product_id: null }, { mode: 'new', rows, data }).product_id).toBe('Column "product_id" cannot be empty.');
    // A column that has a problem of its own is told that one, not the key.
    const bad = validateRecord(items, { ...again, product_id: 999999 }, { mode: 'new', rows, data });
    expect(bad.product_id).toBe('No row in products has id 999999.');
  });

  it('holds a primary key of several columns to one row', () => {
    const link: Table = { name: 'link', columns: [col('INT', { name: 'a', pk: true }), col('INT', { name: 'b', pk: true })] };
    const rows: Row[] = [{ a: 1, b: 2 }];
    expect(compositeKeys(link)).toEqual([['a', 'b']]);
    expect(validateRecord(link, { a: 1, b: 2 }, { mode: 'new', rows }).b).toBe('A row with a "1", b "2" already exists.');
    expect(validateRecord(link, { a: 1, b: 3 }, { mode: 'new', rows })).toEqual({});
    expect(validateRecord(link, { a: 1, b: 2 }, { mode: 'edit', rows, record: rows[0] })).toEqual({});
    // The same key written as an index is the same key.
    expect(compositeKeys({ ...link, indexes: [{ name: 'p', type: 'PRIMARY KEY', using: 'btree', columns: ['b', 'a'] }] })).toEqual([['a', 'b']]);
    expect(compositeKeys({ ...link, indexes: [{ name: 'i', type: 'INDEX', using: 'btree', columns: ['a', 'b'] }] })).toEqual([['a', 'b']]);
  });

  it('words the problem in the language of the app', () => {
    setLocale('vi');
    expect(validateRecord(users, { ...valid, email: '' }, { mode: 'new', data }).email).toBe('Cột "email" không được để trống.');
  });
});

describe('recordLabel', () => {
  it('names a record by its key, or by its first column without one', () => {
    expect(recordLabel(table('users'), data.users[0])).toBe(`users · id = ${data.users[0].id}`);
    expect(recordLabel({ name: 'log', columns: [col('TEXT', { name: 'line' })] }, { line: 'x' })).toBe('log · line = x');
    expect(recordLabel({ name: 'link', columns: [col('INT', { name: 'a', pk: true }), col('INT', { name: 'b', pk: true })] }, { a: 1, b: null })).toBe('link · a = 1, b = NULL');
  });
});

describe('initialValues and completeRecord', () => {
  const orders = table('orders');

  it('starts a new record with the literal defaults and NULL where a column may be empty', () => {
    expect(initialValues(orders, metas(orders))).toEqual({ status: 'pending' });
    expect(initialValues(table('users'), metas(table('users')))).toEqual({ name: null, avatar_url: null });
    expect(initialValues(table('order_items'), metas(table('order_items')))).toEqual({ quantity: 1 });
  });

  it('fills in the counter and the clock the way the database does', () => {
    const rows = data.orders;
    const top = Math.max(...rows.map((r) => r.id as number));
    const row = completeRecord(orders, rows, { user_id: 1, total: '19.90' }, Date.UTC(2025, 2, 4, 10, 15, 0));
    expect(row).toEqual({ id: top + 1, user_id: 1, status: 'pending', total: 19.9, created_at: '2025-03-04 10:15:00' });
    expect(Object.keys(row)).toEqual(orders.columns.map((c) => c.name));
  });

  it('numbers from 1 in an empty table, and leaves what has no default NULL', () => {
    expect(completeRecord(table('users'), [], { email: 'a@b.co' }).id).toBe(1);
    expect(completeRecord(table('users'), [], { email: 'a@b.co' }).avatar_url).toBeNull();
  });

  it('keeps an empty text as text and an empty number as NULL', () => {
    expect(completeRecord(table('users'), [], { email: 'a@b.co', name: '' }).name).toBe('');
    expect(completeRecord(table('payments'), [], { order_id: '', amount: '' }).amount).toBeNull();
  });
});

describe('the record as JSON', () => {
  const t: Table = { name: 't', columns: [col('BIGSERIAL', { name: 'id', pk: true }), col('VARCHAR(20)', { name: 'name' }), col('INT', { name: 'n', nullable: true }), col('JSONB', { name: 'doc', nullable: true })] };
  const ms = t.columns.map((c) => fieldMeta(c, []));

  it('writes a JSON column as the JSON it holds, and leaves out what has no value', () => {
    expect(JSON.parse(recordJson(t, ms, { id: 4, name: 'a', n: '7', doc: '{"k": [1]}' }))).toEqual({ id: 4, name: 'a', n: 7, doc: { k: [1] } });
    expect(JSON.parse(recordJson(t, ms, { name: 'a' }))).toEqual({ name: 'a' });
    expect(recordJson(t, ms, { name: 'a' })).toBe('{\n  "name": "a"\n}');
  });

  it('applies edits to the draft: a column left out keeps its value, a generated one does not change', () => {
    const current = { id: 4, name: 'a', n: 7, doc: '{ "k": 1 }' };
    const next = fromJson(t, ms, current, { id: 99, name: 'b', other: 1, doc: { k: 1 } });
    expect(next).toEqual({ id: 4, name: 'b', n: 7, doc: '{ "k": 1 }' });
    expect(fromJson(t, ms, current, { doc: { k: 2 } }).doc).toBe('{"k":2}');
    expect(fromJson(t, ms, current, { doc: 5 }).doc).toBe('5');
    expect(fromJson(t, ms, current, { n: null }).n).toBeNull();
  });

  it('says what it ignores', () => {
    const current = { id: 4 };
    expect(jsonNotes(t, ms, current, { id: 99, ghost: 1, name: 'x' })).toEqual([
      'Column "id" is generated by the database and is not changed.',
      'Column "ghost" does not exist in t and is ignored.',
    ]);
    expect(jsonNotes(t, ms, current, { id: 4 })).toEqual([]);
  });

  it('turns the draft into the values that were set', () => {
    expect(toRecord(t, ms, { name: 'a', n: '', doc: undefined })).toEqual({ name: 'a', n: null });
  });

  it('reads a text of the JSON tab as a record', () => {
    expect(readRecordJson('{"a":1}')).toEqual({ ok: true, value: { a: 1 } });
    expect(readRecordJson('[1]')).toEqual({ ok: false, line: null });
    expect(readRecordJson('{\n"a":')).toEqual({ ok: false, line: 2 });
  });
});

describe('relatedOf and labelColumn', () => {
  it('finds the rows a record points at and the rows that point at it', () => {
    const order = data.orders[0];
    const related = relatedOf(table('orders'), order, ecommerceTables, data);
    expect(related.out.map((r) => r.key)).toEqual(['out:user_id']);
    expect(related.out[0].rows).toEqual(data.users.filter((u) => u.id === order.user_id));
    expect(related.inn.map((r) => r.key)).toEqual(['in:order_items.order_id', 'in:payments.order_id']);
    expect(related.inn[0].rows).toEqual(data.order_items.filter((x) => x.order_id === order.id));
    expect(relatedOf(table('orders'), { ...order, user_id: null }, ecommerceTables, data).out[0].rows).toEqual([]);
  });

  it('leaves out a table that has no rows to read', () => {
    const related = relatedOf(table('orders'), data.orders[0], ecommerceTables, { users: data.users });
    expect(related.inn).toEqual([]);
    expect(related.out).toHaveLength(1);
  });

  it('names a row by its email, name or first text column', () => {
    expect(labelColumn(table('users'))).toBe('email');
    expect(labelColumn(table('products'))).toBe('name');
    expect(labelColumn(table('payments'))).toBe('provider');
    expect(labelColumn({ columns: [col('INT', { name: 'id', pk: true })] })).toBeNull();
  });
});

describe('what a row action does', () => {
  const users = table('users');

  it('knows a row by its primary key, or by its first column without one', () => {
    expect(rowKey(users, data.users[1])).toBe(JSON.stringify([data.users[1].id]));
    expect(rowKey({ columns: [col('TEXT', { name: 'line' })] }, { line: 'x' })).toBe('["x"]');
  });

  it('lays the values that were set over a row', () => {
    const row = data.users[0];
    expect(mergeRecord(row, { name: 'New', avatar_url: undefined })).toEqual({ ...row, name: 'New' });
    expect(mergeRecord(row, {})).not.toBe(row);
  });

  it('says what a column is in one line', () => {
    expect(typeLine(table('users').columns[1])).toBe('VARCHAR(255) · Unique · Required');
    expect(typeLine(table('users').columns[0])).toBe('BIGSERIAL · Primary key');
    expect(typeLine(table('orders').columns[1])).toBe('BIGINT · Foreign key · Required');
    expect(typeLine(table('orders').columns[4])).toContain('Default');
    setLocale('vi');
    expect(typeLine(table('users').columns[0])).toBe('BIGSERIAL · Khóa chính');
  });

  it('duplicates a row without the value the database counts', () => {
    const copy = duplicateValues(users, data.users[0]);
    expect(Object.keys(copy)).toEqual(['email', 'name', 'avatar_url', 'created_at']);
    expect(copy.email).toBe(data.users[0].email);
  });

  it('copies one row as an object and several as a list, a JSON column as the JSON it holds', () => {
    expect(JSON.parse(rowsJson(users, [data.users[0]]))).toEqual(data.users[0]);
    expect(JSON.parse(rowsJson(users, data.users.slice(0, 2)))).toEqual(data.users.slice(0, 2));
    const doc: Table = { name: 't', columns: [col('JSONB', { name: 'doc' }), col('INT', { name: 'n' })] };
    expect(JSON.parse(rowsJson(doc, [{ doc: '{"a":[1]}', n: null }]))).toEqual({ doc: { a: [1] }, n: null });
    expect(JSON.parse(rowsJson(doc, [{ doc: 'not json', n: 1 }])).doc).toBe('not json');
  });
});
