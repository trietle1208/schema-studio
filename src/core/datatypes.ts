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
