import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, inferredTables, tableNamed } from '../fixtures/testing';
import { declareInferred } from '../relations';
import { generateJson, type JsonOptions } from './json';

const ALL: JsonOptions = { indexes: true, foreignKeys: true, comments: true };
const info = { name: 'ecommerce', version: 12, engine: 'PostgreSQL' };

describe('generateJson', () => {
  it('writes the schema with one column and one index per line', () => {
    const orders = tableNamed(ecommerceSnapshot(), 'orders');
    expect(generateJson(info, [orders], ALL)).toBe(`{
  "schema": "ecommerce",
  "version": 12,
  "dialect": "postgresql",
  "tables": [
    {
      "name": "orders",
      "schema": "public",
      "comment": "Customer orders. Totals are stored, not derived.",
      "columns": [
        { "name": "id", "type": "BIGSERIAL", "pk": true },
        { "name": "user_id", "type": "BIGINT", "fk": { "table": "users", "column": "id", "onDelete": "CASCADE" } },
        { "name": "status", "type": "VARCHAR(50)", "default": "'pending'" },
        { "name": "total", "type": "DECIMAL(12,2)" },
        { "name": "created_at", "type": "TIMESTAMP", "default": "now()" }
      ],
      "indexes": [
        { "name": "orders_pkey", "type": "PRIMARY KEY", "using": "btree", "columns": ["id"] },
        { "name": "orders_user_id_idx", "type": "INDEX", "using": "btree", "columns": ["user_id"] },
        { "name": "orders_status_created_idx", "type": "INDEX", "using": "btree", "columns": ["status", "created_at"] }
      ]
    }
  ]
}
`);
  });

  it('is JSON that holds every table of the ecommerce sample', () => {
    const { tables } = ecommerceSnapshot();
    const json = JSON.parse(generateJson(info, tables, ALL));
    expect(json.tables.map((t: { name: string }) => t.name)).toEqual(['users', 'orders', 'order_items', 'products', 'payments']);
    expect(json.tables[0].columns[2]).toEqual({ name: 'name', type: 'VARCHAR(255)', nullable: true });
    expect(json.tables[0].columns[1]).toEqual({ name: 'email', type: 'VARCHAR(255)', unique: true });
    // A blank comment is not written.
    expect(json.tables[2]).not.toHaveProperty('comment');
  });

  it('leaves out what the options leave out', () => {
    const { tables } = ecommerceSnapshot();
    const json = JSON.parse(generateJson(info, tables, { indexes: false, foreignKeys: false, comments: false }));
    expect(json.tables.every((t: object) => !('indexes' in t) && !('comment' in t))).toBe(true);
    expect(JSON.stringify(json)).not.toContain('"fk"');
  });

  it('has a null version for a schema that is not saved, and an empty list for one without tables', () => {
    expect(generateJson({ name: 'draft', version: null, engine: 'MySQL' }, [], ALL)).toBe(
      '{\n  "schema": "draft",\n  "version": null,\n  "dialect": "mysql",\n  "tables": []\n}\n',
    );
  });

  it('escapes what JSON has to escape', () => {
    const json = generateJson(info, [{ name: 'a"b', columns: [{ name: 'c', type: 'TEXT', default: `'x\\y'`, comment: 'line\nbreak' }], indexes: [] }], ALL);
    expect(JSON.parse(json).tables[0]).toEqual({
      name: 'a"b',
      columns: [{ name: 'c', type: 'TEXT', default: `'x\\y'`, comment: 'line\nbreak' }],
      indexes: [],
    });
  });

  it('leaves out a foreign key that was inferred, until it is declared', () => {
    const orders = inferredTables().filter((t) => t.name === 'orders');
    expect(JSON.parse(generateJson(info, orders, ALL)).tables[0].columns[1]).toEqual({ name: 'user_id', type: 'BIGINT' });
    expect(JSON.parse(generateJson(info, declareInferred(orders), ALL)).tables[0].columns[1].fk).toEqual({
      table: 'users',
      column: 'id',
      onDelete: 'RESTRICT',
    });
  });
});
