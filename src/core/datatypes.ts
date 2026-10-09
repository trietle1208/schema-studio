import { getLocale, isMessageKey, messageText } from './i18n';

/** A data type offered by the type picker, with the family shown beside it. */
export interface DataType {
  name: string;
  family: string;
}

/** The family of a data type as the type picker says it, in the language of the app. */
export function familyLabel(family: string): string {
  const key = `type.family.${family}`;
  return isMessageKey(key) ? messageText(getLocale(), key) : family;
}

export const POSTGRES_TYPES: readonly DataType[] = [
  { name: 'BIGSERIAL', family: 'auto-increment' },
  { name: 'SERIAL', family: 'auto-increment' },
  { name: 'BIGINT', family: 'integer' },
  { name: 'INTEGER', family: 'integer' },
  { name: 'SMALLINT', family: 'integer' },
  { name: 'DECIMAL(12,2)', family: 'exact numeric' },
  { name: 'NUMERIC', family: 'exact numeric' },
  { name: 'VARCHAR(255)', family: 'text' },
  { name: 'VARCHAR(100)', family: 'text' },
  { name: 'VARCHAR(50)', family: 'text' },
  { name: 'TEXT', family: 'text' },
  { name: 'BOOLEAN', family: 'logical' },
  { name: 'TIMESTAMP', family: 'date/time' },
  { name: 'TIMESTAMPTZ', family: 'date/time' },
  { name: 'DATE', family: 'date/time' },
  { name: 'UUID', family: 'identifier' },
  { name: 'JSONB', family: 'document' },
  { name: 'BYTEA', family: 'binary' },
];

/** The same families as MySQL has them. An auto-increment column is an integer that says so, and a UUID is kept as text. */
export const MYSQL_TYPES: readonly DataType[] = [
  { name: 'BIGINT AUTO_INCREMENT', family: 'auto-increment' },
  { name: 'INT AUTO_INCREMENT', family: 'auto-increment' },
  { name: 'BIGINT', family: 'integer' },
  { name: 'INT', family: 'integer' },
  { name: 'SMALLINT', family: 'integer' },
  { name: 'TINYINT', family: 'integer' },
  { name: 'DECIMAL(12,2)', family: 'exact numeric' },
  { name: 'DOUBLE', family: 'approximate numeric' },
  { name: 'VARCHAR(255)', family: 'text' },
  { name: 'VARCHAR(100)', family: 'text' },
  { name: 'VARCHAR(50)', family: 'text' },
  { name: 'TEXT', family: 'text' },
  { name: 'LONGTEXT', family: 'text' },
  { name: 'BOOLEAN', family: 'logical' },
  { name: 'DATETIME', family: 'date/time' },
  { name: 'TIMESTAMP', family: 'date/time' },
  { name: 'DATE', family: 'date/time' },
  { name: 'CHAR(36)', family: 'identifier' },
  { name: 'JSON', family: 'document' },
  { name: 'BLOB', family: 'binary' },
];

const TYPE_LISTS: Record<string, readonly DataType[]> = { PostgreSQL: POSTGRES_TYPES, MySQL: MYSQL_TYPES };

/** The engine whose types the type picker offers in a schema for `engine`: its own, or PostgreSQL for one without a list. */
export function typeEngine(engine: string): string {
  return engine in TYPE_LISTS ? engine : 'PostgreSQL';
}

/** The types the type picker offers in a schema for `engine`. */
export function typesFor(engine: string): readonly DataType[] {
  return TYPE_LISTS[typeEngine(engine)];
}

/** Free text from the type picker as it is stored: trimmed and upper-cased, so `varchar(64)` becomes `VARCHAR(64)`. */
export function normalizeType(text: string): string {
  return text.trim().toUpperCase();
}

/** The types whose name contains `query`, ignoring case. An empty query matches all of them. */
export function matchTypes(query: string, types: readonly DataType[] = POSTGRES_TYPES): DataType[] {
  const needle = normalizeType(query);
  return needle ? types.filter((t) => t.name.includes(needle)) : [...types];
}

/** The integer type an auto-increment type stores: `BIGSERIAL` is a `BIGINT` with a sequence. Null for any other type. */
export function serialType(type: string): string | null {
  const name = normalizeType(type);
  if (name === 'SMALLSERIAL' || name === 'SERIAL2') return 'SMALLINT';
  if (name === 'SERIAL' || name === 'SERIAL4') return 'INTEGER';
  if (name === 'BIGSERIAL' || name === 'SERIAL8') return 'BIGINT';
  return null;
}

/**
 * The type of a column that references a column of `type`: the same one, without the counting.
 * `BIGSERIAL` is referenced by a `BIGINT`, `INT UNSIGNED AUTO_INCREMENT` by an `INT UNSIGNED`.
 */
export function referencingType(type: string): string {
  return serialType(type) ?? type.replace(/\s*\bAUTO_INCREMENT\b/gi, '').trim();
}

const ALIASES: Record<string, string> = {
  INT: 'INTEGER',
  INT4: 'INTEGER',
  INT8: 'BIGINT',
  INT2: 'SMALLINT',
  NUMERIC: 'DECIMAL',
  'CHARACTER VARYING': 'VARCHAR',
  CHARACTER: 'CHAR',
  BPCHAR: 'CHAR',
};

const INTEGER_SIZE: Record<string, number> = { SMALLINT: 2, INTEGER: 4, BIGINT: 8 };

/** A type as its name and the numbers in its brackets: `DECIMAL(12,2)` is `DECIMAL` with 12 and 2. */
function parseType(type: string): { name: string; args: number[] } | null {
  const match = /^([A-Z][A-Z0-9 ]*?)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?$/.exec(normalizeType(type));
  if (!match) return null;
  const name = serialType(match[1]) ?? ALIASES[match[1]] ?? match[1];
  return { name, args: match.slice(2).flatMap((n) => (n === undefined ? [] : [Number(n)])) };
}

/**
 * Whether every value of the type `from` fits the type `to` as it is, so that changing a column
 * from one to the other can neither fail nor lose anything: a longer VARCHAR, a larger integer,
 * more digits. A change this cannot vouch for is not one.
 */
export function widensType(from: string, to: string): boolean {
  const a = parseType(from);
  const b = parseType(to);
  if (!a || !b) return false;
  if (a.name === b.name && a.args.length === b.args.length && a.args.every((n, i) => n === b.args[i])) return true;

  if (a.name in INTEGER_SIZE) {
    if (b.name in INTEGER_SIZE) return INTEGER_SIZE[a.name] <= INTEGER_SIZE[b.name];
    // A DECIMAL without a precision holds any integer.
    return b.name === 'DECIMAL' && b.args.length === 0;
  }
  if (a.name === 'CHAR' || a.name === 'VARCHAR') {
    if (b.name === 'TEXT') return true;
    if (b.name !== 'VARCHAR') return false;
    // A CHAR without a length holds one character, a VARCHAR without one any number.
    const length = a.args[0] ?? (a.name === 'CHAR' ? 1 : Infinity);
    return length <= (b.args[0] ?? Infinity);
  }
  if (a.name === 'DECIMAL' && b.name === 'DECIMAL') {
    if (!b.args.length) return true;
    if (!a.args.length) return false;
    const [precision, scale = 0] = a.args;
    const [toPrecision, toScale = 0] = b.args;
    return toScale >= scale && toPrecision - toScale >= precision - scale;
  }
  return false;
}

const MYSQL_INTEGER_SIZE: Record<string, number> = { TINYINT: 1, SMALLINT: 2, MEDIUMINT: 3, INT: 4, INTEGER: 4, BIGINT: 8 };
/** The text and binary types without a length, each family from the smallest to the largest. */
const MYSQL_TEXT_SIZE: Record<string, number> = { TINYTEXT: 1, TEXT: 2, MEDIUMTEXT: 3, LONGTEXT: 4 };
const MYSQL_BLOB_SIZE: Record<string, number> = { TINYBLOB: 1, BLOB: 2, MEDIUMBLOB: 3, LONGBLOB: 4 };
/** How many digits a DECIMAL has when it does not say. */
const MYSQL_DECIMAL_DIGITS = 10;

interface MysqlType {
  name: string;
  args: number[];
  unsigned: boolean;
}

/** A MySQL type in its parts: `INT(11) UNSIGNED AUTO_INCREMENT` is `INT` with 11, without a sign. Counting by itself does not change what fits. */
function parseMysqlType(type: string): MysqlType | null {
  const match = /^([A-Z][A-Z0-9]*(?: [A-Z]+)*?)\s*(?:\(\s*(\d+)\s*(?:,\s*(\d+)\s*)?\))?((?: (?:UNSIGNED|ZEROFILL|AUTO_INCREMENT))*)$/.exec(
    normalizeType(type),
  );
  if (!match) return null;
  const name = match[1] === 'NUMERIC' || match[1] === 'DEC' ? 'DECIMAL' : match[1];
  const args = match.slice(2, 4).flatMap((n) => (n === undefined ? [] : [Number(n)]));
  // ZEROFILL makes a column UNSIGNED without saying so.
  return { name, args, unsigned: /UNSIGNED|ZEROFILL/.test(match[4]) };
}

/** `widensType` for the types of MySQL: an integer may not lose its sign, and a text has a largest size. */
export function widensMysqlType(from: string, to: string): boolean {
  const a = parseMysqlType(from);
  const b = parseMysqlType(to);
  if (!a || !b) return false;

  if (a.name in MYSQL_INTEGER_SIZE && b.name in MYSQL_INTEGER_SIZE) {
    // The number in the brackets of an integer is how wide it is shown, not what it holds.
    const size = MYSQL_INTEGER_SIZE[a.name];
    const toSize = MYSQL_INTEGER_SIZE[b.name];
    if (a.unsigned === b.unsigned) return size <= toSize;
    // Only a larger signed integer holds every value of an unsigned one.
    return a.unsigned && size < toSize;
  }
  if (a.name === b.name && a.unsigned === b.unsigned && a.args.length === b.args.length && a.args.every((n, i) => n === b.args[i])) return true;

  if (a.name === 'CHAR' || a.name === 'VARCHAR') {
    // A VARCHAR is at most as long as a TEXT.
    if (b.name in MYSQL_TEXT_SIZE) return MYSQL_TEXT_SIZE[b.name] >= MYSQL_TEXT_SIZE.TEXT;
    // A CHAR without a length holds one character; a VARCHAR always says its length.
    const fits = (a.args[0] ?? 1) <= (b.args[0] ?? 1);
    return fits && (b.name === 'VARCHAR' ? b.args.length === 1 : b.name === 'CHAR' && a.name === 'CHAR');
  }
  if (a.name in MYSQL_TEXT_SIZE && b.name in MYSQL_TEXT_SIZE) return MYSQL_TEXT_SIZE[a.name] <= MYSQL_TEXT_SIZE[b.name];
  if (a.name in MYSQL_BLOB_SIZE && b.name in MYSQL_BLOB_SIZE) return MYSQL_BLOB_SIZE[a.name] <= MYSQL_BLOB_SIZE[b.name];
  if (a.name === 'DECIMAL' && b.name === 'DECIMAL') {
    if (a.unsigned !== b.unsigned && !a.unsigned) return false;
    const [precision = MYSQL_DECIMAL_DIGITS, scale = 0] = a.args;
    const [toPrecision = MYSQL_DECIMAL_DIGITS, toScale = 0] = b.args;
    return toScale >= scale && toPrecision - toScale >= precision - scale;
  }
  return false;
}
