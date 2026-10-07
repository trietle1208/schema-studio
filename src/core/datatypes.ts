/** A data type offered by the type picker, with the family shown beside it. */
export interface DataType {
  name: string;
  family: string;
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
