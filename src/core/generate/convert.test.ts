import { describe, expect, it } from 'vitest';
import { ecommerceMysqlDump } from '../fixtures/sql';
import { ecommerceSnapshot, previousSnapshot } from '../fixtures/testing';
import type { Column, Table } from '../model';
import { mysqlParser } from '../parse/mysql';
import { convertsTypes, convertTables } from './convert';
import { mysqlGenerator } from './mysql';
import { postgresGenerator } from './postgres';

const sample = () => ecommerceSnapshot().tables;

/** The ecommerce sample as a MySQL database has it: the tables of its mysqldump script. */
function shop(): Table[] {
  const outcome = mysqlParser.parse(ecommerceMysqlDump);
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.tables;
}

/** One column as the other engine writes it: its type and its default. */
function converted(from: string, to: string, type: string, value?: string): [string, string | undefined] {
  const column: Column = { name: 'c', type, ...(value === undefined ? {} : { default: value }) };
  const [table] = convertTables([{ name: 't', columns: [column] }], from, to);
  return [table.columns[0].type, table.columns[0].default];
}
const toMysql = (type: string, value?: string) => converted('PostgreSQL', 'MySQL', type, value);
const toPostgres = (type: string, value?: string) => converted('MySQL', 'PostgreSQL', type, value);

const types = (tables: readonly Table[], name: string) =>
  Object.fromEntries((tables.find((t) => t.name === name)?.columns ?? []).map((c) => [c.name, c.type]));

describe('convertTables', () => {
  it('gives the tables themselves for the engine they were made for, or one it does not know', () => {
    const tables = sample();
    expect(convertTables(tables, 'PostgreSQL', 'PostgreSQL')).toBe(tables);
    expect(convertTables(tables, 'SQLite', 'MySQL')).toBe(tables);
    expect(convertsTypes('PostgreSQL', 'MySQL')).toBe(true);
    expect(convertsTypes('MySQL', 'PostgreSQL')).toBe(true);
    expect(convertsTypes('MySQL', 'MySQL')).toBe(false);
    expect(convertsTypes('ClickHouse', 'PostgreSQL')).toBe(false);
  });

  it('changes types and defaults only: names, keys, indexes and comments stay', () => {
    const strip = (tables: readonly Table[]) => tables.map((t) => ({ ...t, columns: t.columns.map((c) => ({ ...c, type: '', default: '' })) }));
    expect(strip(convertTables(sample(), 'PostgreSQL', 'MySQL'))).toEqual(strip(sample()));
    expect(strip(convertTables(shop(), 'MySQL', 'PostgreSQL'))).toEqual(strip(shop()));
  });
});

describe('PostgreSQL → MySQL', () => {
  it('writes the ecommerce sample with the types MySQL has', () => {
    const tables = convertTables(sample(), 'PostgreSQL', 'MySQL');
    expect(types(tables, 'orders')).toEqual({
      id: 'BIGINT AUTO_INCREMENT',
      user_id: 'BIGINT',
      status: 'VARCHAR(50)',
      total: 'DECIMAL(12,2)',
      created_at: 'DATETIME',
    });
    expect(types(tables, 'payments').paid_at).toBe('TIMESTAMP');
    expect(mysqlGenerator.generate(tables.filter((t) => t.name === 'payments'), { foreignKeys: false })).toBe(`CREATE TABLE \`payments\` (
  \`id\`        BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`order_id\`  BIGINT NOT NULL,
  \`provider\`  VARCHAR(32) NOT NULL,
  \`amount\`    DECIMAL(12,2) NOT NULL,
  \`paid_at\`   TIMESTAMP
);
`);
  });

  it('makes an auto-increment type an integer that counts', () => {
    expect(toMysql('SERIAL')[0]).toBe('INT AUTO_INCREMENT');
    expect(toMysql('bigserial')[0]).toBe('BIGINT AUTO_INCREMENT');
    expect(toMysql('SMALLSERIAL')[0]).toBe('SMALLINT AUTO_INCREMENT');
  });

  it('keeps a moment in UTC as a TIMESTAMP and a time as it is written as a DATETIME', () => {
    expect(toMysql('TIMESTAMPTZ')[0]).toBe('TIMESTAMP');
    expect(toMysql('TIMESTAMP(3)')[0]).toBe('DATETIME(3)');
    expect(toMysql('TIMETZ')[0]).toBe('TIME');
  });

  it('gives the types MySQL lacks the type that holds the same', () => {
    expect(toMysql('UUID')[0]).toBe('CHAR(36)');
    expect(toMysql('JSONB')[0]).toBe('JSON');
    expect(toMysql('BYTEA')[0]).toBe('LONGBLOB');
    expect(toMysql('REAL')[0]).toBe('FLOAT');
    expect(toMysql('VARCHAR')[0]).toBe('TEXT');
    expect(toMysql('TEXT[]')[0]).toBe('JSON');
    expect(toMysql('VARCHAR(10)[]')[0]).toBe('JSON');
  });

  it('leaves the types MySQL reads the same way, and those it does not know', () => {
    for (const type of ['BIGINT', 'INTEGER', 'VARCHAR(255)', 'TEXT', 'BOOLEAN', 'DECIMAL(12,2)', 'NUMERIC(10,4)', 'DATE', 'DOUBLE PRECISION', 'order_status', '']) {
      expect(toMysql(type)[0]).toBe(type);
    }
    // A type that is written for MySQL already is not read as one of PostgreSQL.
    expect(toMysql('TIMESTAMP UNSIGNED')[0]).toBe('TIMESTAMP UNSIGNED');
  });

  it('takes the type off a default that pg_dump wrote one on', () => {
    expect(toMysql('VARCHAR(50)', "'pending'::character varying")).toEqual(['VARCHAR(50)', "'pending'"]);
    expect(toMysql('DECIMAL(12,2)', '0::numeric(12,2)')[1]).toBe('0');
    expect(toMysql('UUID', 'gen_random_uuid()')).toEqual(['CHAR(36)', '(UUID())']);
    expect(toMysql('TIMESTAMP', 'now()')[1]).toBe('now()');
    expect(toMysql('TEXT', "'a::b'")[1]).toBe("'a::b'");
    expect(toMysql('INTEGER')[1]).toBeUndefined();
  });

  it('gives a referencing column the integer type of the column it references', () => {
    // legacy_orders.user_id is an INTEGER that references a BIGSERIAL, which MySQL refuses.
    const tables = convertTables(previousSnapshot().tables, 'PostgreSQL', 'MySQL');
    expect(types(tables, 'users').id).toBe('BIGINT AUTO_INCREMENT');
    expect(types(tables, 'legacy_orders')).toEqual({ id: 'INTEGER', user_id: 'BIGINT', items_json: 'TEXT', placed_on: 'DATE' });
  });

  it('follows a chain of references, and leaves a reference between other types alone', () => {
    const table = (name: string, type: string, fk?: string): Table => ({
      name,
      columns: [{ name: 'id', type, pk: true, ...(fk ? { fk: { table: fk, column: 'id' } } : {}) }],
    });
    const tables = convertTables([table('c', 'SMALLINT', 'b'), table('b', 'INTEGER', 'a'), table('a', 'BIGSERIAL'), table('d', 'UUID', 'e'), table('e', 'TEXT')], 'PostgreSQL', 'MySQL');
    expect(tables.map((t) => t.columns[0].type)).toEqual(['BIGINT', 'BIGINT', 'BIGINT AUTO_INCREMENT', 'CHAR(36)', 'TEXT']);
  });
});

describe('MySQL → PostgreSQL', () => {
  it('writes the shop with the types PostgreSQL has', () => {
    const tables = convertTables(shop(), 'MySQL', 'PostgreSQL');
    expect(types(tables, 'orders')).toEqual({
      id: 'BIGSERIAL',
      user_id: 'BIGINT',
      status: 'TEXT',
      total: 'DECIMAL(12,2)',
      created_at: 'TIMESTAMPTZ',
      updated_at: 'TIMESTAMPTZ',
    });
    expect(types(tables, 'payments').paid_at).toBe('TIMESTAMP');
    expect(postgresGenerator.generate(tables.filter((t) => t.name === 'order_items'), { indexes: false, foreignKeys: false }))
      .toBe(`CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL,
  product_id  BIGINT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT '1',
  price       DECIMAL(12,2) NOT NULL
);
`);
  });

  it('makes an integer that counts an auto-increment type', () => {
    expect(toPostgres('INT(11) AUTO_INCREMENT')[0]).toBe('SERIAL');
    expect(toPostgres('BIGINT UNSIGNED AUTO_INCREMENT')[0]).toBe('BIGSERIAL');
    expect(toPostgres('SMALLINT AUTO_INCREMENT')[0]).toBe('SMALLSERIAL');
    expect(toPostgres('SERIAL')[0]).toBe('BIGSERIAL');
  });

  it('drops the display width and the sign of an integer, and takes TINYINT(1) for a BOOLEAN', () => {
    expect(toPostgres('INT(11)')[0]).toBe('INTEGER');
    expect(toPostgres('INT UNSIGNED')[0]).toBe('INTEGER');
    expect(toPostgres('MEDIUMINT')[0]).toBe('INTEGER');
    expect(toPostgres('TINYINT(4)')[0]).toBe('SMALLINT');
    expect(toPostgres('BIGINT(20) UNSIGNED ZEROFILL')[0]).toBe('BIGINT');
    expect(toPostgres('TINYINT(1)')[0]).toBe('BOOLEAN');
    expect(toPostgres('DECIMAL(12,2) UNSIGNED')[0]).toBe('DECIMAL(12,2)');
  });

  it('gives the types PostgreSQL lacks the type that holds the same', () => {
    expect(toPostgres('DATETIME(6)')[0]).toBe('TIMESTAMP(6)');
    expect(toPostgres('TIMESTAMP')[0]).toBe('TIMESTAMPTZ');
    expect(toPostgres('LONGTEXT')[0]).toBe('TEXT');
    expect(toPostgres('MEDIUMBLOB')[0]).toBe('BYTEA');
    expect(toPostgres('VARBINARY(16)')[0]).toBe('BYTEA');
    expect(toPostgres('DOUBLE')[0]).toBe('DOUBLE PRECISION');
    expect(toPostgres('FLOAT')[0]).toBe('REAL');
    expect(toPostgres('JSON')[0]).toBe('JSONB');
    expect(toPostgres("ENUM('a','b')")[0]).toBe('TEXT');
    expect(toPostgres('YEAR')[0]).toBe('SMALLINT');
  });

  it('leaves the types PostgreSQL reads the same way, and those it does not know', () => {
    for (const type of ['BIGINT', 'VARCHAR(255)', 'CHAR(36)', 'TEXT', 'BOOLEAN', 'DATE', 'TIME', 'POINT', '']) {
      expect(toPostgres(type)[0]).toBe(type);
    }
  });

  it('writes the default of a BOOLEAN as one, and CURRENT_TIMESTAMP without empty brackets', () => {
    expect(toPostgres('TINYINT(1)', "'1'")).toEqual(['BOOLEAN', 'true']);
    expect(toPostgres('TINYINT(1)', '0')).toEqual(['BOOLEAN', 'false']);
    expect(toPostgres('TIMESTAMP', 'current_timestamp()')).toEqual(['TIMESTAMPTZ', 'CURRENT_TIMESTAMP']);
    expect(toPostgres('DATETIME(6)', 'CURRENT_TIMESTAMP(6)')[1]).toBe('CURRENT_TIMESTAMP(6)');
    expect(toPostgres('CHAR(36)', '(uuid())')[1]).toBe('gen_random_uuid()');
    expect(toPostgres('INT', "'1'")[1]).toBe("'1'");
  });
});

describe('inferred foreign keys', () => {
  const tables = (inferred: boolean): Table[] => [
    { name: 'users', columns: [{ name: 'id', type: 'BIGSERIAL', pk: true }] },
    { name: 'orders', columns: [{ name: 'user_id', type: 'INTEGER', fk: { table: 'users', column: 'id', ...(inferred ? { inferred } : {}) } }] },
  ];

  it('change no type: only a foreign key that is written has to match the column it references', () => {
    expect(convertTables(tables(false), 'PostgreSQL', 'MySQL')[1].columns[0].type).toBe('BIGINT');
    expect(convertTables(tables(true), 'PostgreSQL', 'MySQL')[1].columns[0].type).toBe('INTEGER');
  });
});
