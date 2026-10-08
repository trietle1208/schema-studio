import { normalizeType } from '../datatypes';
import type { Column, Table } from '../model';

// A schema is made for one engine, and its types and defaults are written the way that engine has
// them. Before its DDL is written for another engine, what the other one would refuse, or would
// read as something else, is put the way it writes the same thing: `BIGSERIAL` becomes
// `BIGINT AUTO_INCREMENT`, `DATETIME` becomes `TIMESTAMP`. Everything else stays as it is, so a
// type neither list knows is written as the schema has it.

/** A type in its parts: `DECIMAL(12,2) UNSIGNED` is `DECIMAL`, `(12,2)` and `UNSIGNED`. */
interface TypeParts {
  name: string;
  /** What is in brackets after the name, with the brackets; empty when there is none. */
  args: string;
  /** The words after that, which MySQL uses to make a type another one. */
  attributes: string[];
}

function parts(type: string): TypeParts {
  const match = /^([^(]*?)\s*(\(.*\))?((?:\s+(?:UNSIGNED|SIGNED|ZEROFILL|AUTO_INCREMENT))*)$/i.exec(type.trim());
  if (!match) return { name: normalizeType(type), args: '', attributes: [] };
  return {
    name: normalizeType(match[1]).replace(/\s+/g, ' '),
    args: match[2] ?? '',
    attributes: normalizeType(match[3]).split(/\s+/).filter(Boolean),
  };
}

/** The column with its type and default put another way; the column itself when nothing changes. */
function rewritten(column: Column, type: string, value: string | undefined): Column {
  if (type === column.type && value === column.default) return column;
  return value === undefined ? { ...column, type } : { ...column, type, default: value };
}

// ------------------------------------------------------------------------- PostgreSQL → MySQL

/** The types MySQL has under another name. A function gets the brackets of the type and gives the type to write. */
const MYSQL_TYPE: Record<string, string | ((args: string) => string)> = {
  SMALLSERIAL: 'SMALLINT AUTO_INCREMENT',
  SERIAL2: 'SMALLINT AUTO_INCREMENT',
  SERIAL: 'INT AUTO_INCREMENT',
  SERIAL4: 'INT AUTO_INCREMENT',
  BIGSERIAL: 'BIGINT AUTO_INCREMENT',
  SERIAL8: 'BIGINT AUTO_INCREMENT',
  // REAL is a DOUBLE in MySQL.
  REAL: 'FLOAT',
  // A TIMESTAMP of MySQL is kept in UTC, as a TIMESTAMPTZ is; a DATETIME is taken as it is written.
  TIMESTAMP: (args) => `DATETIME${args}`,
  'TIMESTAMP WITHOUT TIME ZONE': (args) => `DATETIME${args}`,
  TIMESTAMPTZ: (args) => `TIMESTAMP${args}`,
  'TIMESTAMP WITH TIME ZONE': (args) => `TIMESTAMP${args}`,
  TIMETZ: (args) => `TIME${args}`,
  'TIME WITH TIME ZONE': (args) => `TIME${args}`,
  'TIME WITHOUT TIME ZONE': (args) => `TIME${args}`,
  UUID: 'CHAR(36)',
  JSONB: 'JSON',
  BYTEA: 'LONGBLOB',
  // A VARCHAR has to say its length.
  VARCHAR: (args) => (args ? `VARCHAR${args}` : 'TEXT'),
  'CHARACTER VARYING': (args) => (args ? `VARCHAR${args}` : 'TEXT'),
};

function mysqlType(type: string): string {
  // MySQL has no arrays; a list is kept as a document.
  if (/\[\d*\]$/.test(type.trim())) return 'JSON';
  const { name, args, attributes } = parts(type);
  const to = MYSQL_TYPE[name];
  // A type with one of MySQL's own words after it is written for MySQL already.
  if (to === undefined || attributes.length) return type;
  return typeof to === 'string' ? to : to(args);
}

function mysqlDefault(text: string): string {
  if (/^(gen_random_uuid|uuid_generate_v4)\s*\(\s*\)$/i.test(text)) return '(UUID())';
  // pg_dump says what type a literal is: `'pending'::character varying`.
  return text.replace(/::\s*"?[a-z_][\w ."]*(\(\s*\d+\s*(,\s*\d+\s*)?\))?(\[\])*$/i, '');
}

function toMysql(column: Column): Column {
  return rewritten(column, mysqlType(column.type), column.default?.trim() ? mysqlDefault(column.default.trim()) : column.default);
}

/** An integer type of MySQL as a column that references it has to be: `INT(11) UNSIGNED AUTO_INCREMENT` is `INT UNSIGNED`. Null for any other type. */
function mysqlInteger(type: string): string | null {
  const { name, attributes } = parts(type);
  const integer = name === 'INTEGER' ? 'INT' : name;
  if (!['TINYINT', 'SMALLINT', 'MEDIUMINT', 'INT', 'BIGINT'].includes(integer)) return null;
  return attributes.includes('UNSIGNED') || attributes.includes('ZEROFILL') ? `${integer} UNSIGNED` : integer;
}

/**
 * PostgreSQL lets an INTEGER reference a BIGINT; MySQL only takes a foreign key between two
 * integers of the same size and sign. The referencing column takes the type of the one it references.
 * An inferred foreign key is not written, so it changes no type.
 */
function alignForeignKeys(tables: readonly Table[]): Table[] {
  let aligned = [...tables];
  // A column that is given another type may itself be referenced, so this goes on until nothing changes.
  for (let pass = 0; pass <= tables.length; pass++) {
    const types = new Map(aligned.flatMap((t) => t.columns.map((c) => [`${t.name}.${c.name}`, mysqlInteger(c.type)] as const)));
    let changed = false;
    aligned = aligned.map((table) => ({
      ...table,
      columns: table.columns.map((column) => {
        const referenced = column.fk && !column.fk.inferred ? types.get(`${column.fk.table}.${column.fk.column}`) : null;
        const own = mysqlInteger(column.type);
        if (!referenced || !own || own === referenced) return column;
        changed = true;
        return { ...column, type: /AUTO_INCREMENT/i.test(column.type) ? `${referenced} AUTO_INCREMENT` : referenced };
      }),
    }));
    if (!changed) break;
  }
  return aligned;
}

const eachColumn = (tables: readonly Table[], convert: (column: Column) => Column): Table[] =>
  tables.map((table) => ({ ...table, columns: table.columns.map(convert) }));

// ------------------------------------------------------------------------- MySQL → PostgreSQL

const POSTGRES_INTEGER: Record<string, string> = { TINYINT: 'SMALLINT', SMALLINT: 'SMALLINT', MEDIUMINT: 'INTEGER', INT: 'INTEGER', INTEGER: 'INTEGER', BIGINT: 'BIGINT' };
const POSTGRES_SERIAL: Record<string, string> = { SMALLINT: 'SMALLSERIAL', INTEGER: 'SERIAL', BIGINT: 'BIGSERIAL' };

const POSTGRES_TYPE: Record<string, string | ((args: string) => string)> = {
  // SERIAL is an unsigned BIGINT that counts.
  SERIAL: 'BIGSERIAL',
  DECIMAL: (args) => `DECIMAL${args}`,
  NUMERIC: (args) => `NUMERIC${args}`,
  FLOAT: 'REAL',
  DOUBLE: 'DOUBLE PRECISION',
  'DOUBLE PRECISION': 'DOUBLE PRECISION',
  REAL: 'DOUBLE PRECISION',
  DATETIME: (args) => `TIMESTAMP${args}`,
  TIMESTAMP: (args) => `TIMESTAMPTZ${args}`,
  YEAR: 'SMALLINT',
  TINYTEXT: 'TEXT',
  MEDIUMTEXT: 'TEXT',
  LONGTEXT: 'TEXT',
  TINYBLOB: 'BYTEA',
  BLOB: 'BYTEA',
  MEDIUMBLOB: 'BYTEA',
  LONGBLOB: 'BYTEA',
  BINARY: 'BYTEA',
  VARBINARY: 'BYTEA',
  // The model has no place for a type of the schema's own, which is what an ENUM is in PostgreSQL.
  ENUM: 'TEXT',
  SET: 'TEXT',
  JSON: 'JSONB',
};

function postgresType(type: string): string {
  const { name, args, attributes } = parts(type);
  const integer = POSTGRES_INTEGER[name];
  if (integer) {
    if (attributes.includes('AUTO_INCREMENT')) return POSTGRES_SERIAL[integer];
    // TINYINT(1) is how MySQL keeps a BOOLEAN. Any other number in the brackets only says how wide the value is shown.
    return name === 'TINYINT' && args === '(1)' ? 'BOOLEAN' : integer;
  }
  const to = POSTGRES_TYPE[name];
  // UNSIGNED and ZEROFILL have no counterpart: the type keeps its size and loses the word.
  if (to === undefined) return attributes.length ? `${name}${args}` : type;
  return typeof to === 'string' ? to : to(args);
}

const BOOLEAN_DEFAULT: Record<string, string> = { '0': 'false', "'0'": 'false', "b'0'": 'false', '1': 'true', "'1'": 'true', "b'1'": 'true' };

function postgresDefault(text: string, type: string): string {
  if (type === 'BOOLEAN') return BOOLEAN_DEFAULT[text.toLowerCase()] ?? text;
  // MariaDB writes the function with its empty brackets, which PostgreSQL does not take.
  if (/^current_timestamp\s*\(\s*\)$/i.test(text)) return 'CURRENT_TIMESTAMP';
  if (/^\(\s*uuid\s*\(\s*\)\s*\)$/i.test(text)) return 'gen_random_uuid()';
  return text;
}

function toPostgres(column: Column): Column {
  const type = postgresType(column.type);
  return rewritten(column, type, column.default?.trim() ? postgresDefault(column.default.trim(), type) : column.default);
}

// ---------------------------------------------------------------------------------------------

const CONVERTERS: Record<string, Record<string, (tables: readonly Table[]) => Table[]>> = {
  PostgreSQL: { MySQL: (tables) => alignForeignKeys(eachColumn(tables, toMysql)) },
  MySQL: { PostgreSQL: (tables) => eachColumn(tables, toPostgres) },
};

/** Whether the types of a schema for `from` are put another way when its DDL is written for `to`. */
export function convertsTypes(from: string, to: string): boolean {
  return CONVERTERS[from]?.[to] !== undefined;
}

/**
 * The tables of a schema made for the engine `from`, with their types and defaults as the engine
 * `to` writes them. They are the tables themselves when the two are the same, or when it is not
 * known how one reads the other.
 */
export function convertTables(tables: readonly Table[], from: string, to: string): readonly Table[] {
  return CONVERTERS[from]?.[to]?.(tables) ?? tables;
}
