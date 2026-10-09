import { primaryKey } from '../constraints';
import type { Column, Table } from '../model';
import { singular } from '../relations';
import {
  between,
  columnKind,
  DAY,
  formatMoment,
  hashText,
  HEX,
  momentFor,
  numberRange,
  pick,
  randomChars,
  randomFrom,
  textFor,
  trueChance,
  type Kind,
  type Random,
} from './seedValues';

// Sample data for a schema: rows of values that fit the types of the columns, are unique where a
// column or an index says so, and reference rows that exist where a foreign key says so. Tables are
// filled parents first. The same schema, row count and seed always give the same rows.

export interface SeedOptions {
  /** How many rows each table gets, at most. */
  rows: number;
  /** Which data is drawn: another number gives other rows. */
  seed: number;
}

export const DEFAULT_SEED_OPTIONS: SeedOptions = { rows: 10, seed: 1 };
export const MAX_SEED_ROWS = 1000;

/** A column's own default is to be used: the engines read `DEFAULT` in a list of values so. */
export interface SeedDefault {
  kind: 'default';
}

/** Bytes, as a string of hex digits. */
export interface SeedBinary {
  kind: 'binary';
  hex: string;
}

export type SeedValue = null | boolean | number | string | SeedDefault | SeedBinary;

export interface SeedTable {
  table: Table;
  /** The columns that are written, in the order of the table. */
  columns: Column[];
  rows: SeedValue[][];
  /** The columns whose values count up from 1, so that the engine's counter has to be moved past them. */
  counters: string[];
}

export interface SeedData {
  /** The tables that have rows, parents before the tables that reference them. */
  tables: SeedTable[];
  /** What could not be made as asked, one line each: a table with fewer rows, a column without a sample. */
  notes: string[];
}

/** How often a column that may be empty is. */
const NULL_CHANCE = 0.1;
/** A table that references itself has this many rows at the top of its tree. */
const ROOT_CHANCE = 0.3;
/** How often a row is drawn again when it repeats what has to be unique. */
const RETRIES = 30;

/** The row count of an options object, kept within what a seed can hold. */
export function clampRows(rows: number): number {
  return Number.isFinite(rows) ? Math.min(MAX_SEED_ROWS, Math.max(1, Math.floor(rows))) : DEFAULT_SEED_OPTIONS.rows;
}

const PEOPLE = /(^|_)(users?|customers?|employees?|people|persons?|members?|authors?|accounts?|contacts?|clients?|students?|teachers?|patients?|doctors?|staff|owners?|profiles?)$/;

/** The unique sets of a table: each is the columns whose values together may not repeat. */
function uniqueSets(table: Table): string[][] {
  const sets: string[][] = [];
  const key = primaryKey(table);
  if (key) sets.push(key.columns);
  for (const c of table.columns) if (c.unique && !c.pk) sets.push([c.name]);
  for (const index of table.indexes ?? []) if (index.type === 'UNIQUE' && index.columns.length) sets.push(index.columns);
  const seen = new Set<string>();
  return sets.filter((set) => {
    const id = [...set].sort().join('\u0000');
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/** Tables with the ones they reference first. Tables in a cycle come last, in their own order. */
function inOrder(tables: readonly Table[]): Table[] {
  const names = new Set(tables.map((t) => t.name));
  const needs = new Map(
    tables.map((t) => [t.name, new Set(t.columns.flatMap((c) => (c.fk && c.fk.table !== t.name && names.has(c.fk.table) ? [c.fk.table] : [])))]),
  );
  const done = new Set<string>();
  const ordered: Table[] = [];
  for (let progress = true; progress && ordered.length < tables.length; ) {
    progress = false;
    for (const table of tables) {
      if (done.has(table.name) || ![...(needs.get(table.name) ?? [])].every((n) => done.has(n))) continue;
      done.add(table.name);
      ordered.push(table);
      progress = true;
    }
  }
  return [...ordered, ...tables.filter((t) => !done.has(t.name))];
}

/** A text that is not in `taken`, made out of `text` by numbering it, and no longer than `max`. */
function distinctText(text: string, row: number, taken: ReadonlySet<unknown>, max: number | null): string {
  const cut = (value: string) => (max === null ? value : value.slice(0, max));
  if (!taken.has(cut(text))) return cut(text);
  for (let k = 0; k < 50; k++) {
    const suffix = `-${row + 1}${k ? `-${k}` : ''}`;
    // A value keeps room for the number that makes it different; an email keeps its domain.
    const at = text.indexOf('@');
    const head = at > 0 ? text.slice(0, at) : text;
    const tail = at > 0 ? text.slice(at) : '';
    const room = max === null ? head.length : Math.max(0, max - suffix.length - tail.length);
    const candidate = cut(`${head.slice(0, room)}${suffix}${tail}`);
    if (!taken.has(candidate)) return candidate;
  }
  return cut(text);
}

interface RowContext {
  r: Random;
  row: number;
  /** What one row of the table is called: `users` → `user`. */
  noun: string;
  /** Whether the table is about people. */
  person: boolean;
  /** The moments of the timestamp columns of this row so far, by column name. */
  stamps: Map<string, number>;
}

/** The value of a column that has no foreign key. `unique` means no other row of the table may have the same. */
function valueOf(column: Column, kind: Kind, unique: boolean, taken: ReadonlySet<unknown>, c: RowContext): SeedValue {
  const { r, row } = c;
  switch (kind.type) {
    case 'serial':
      return row + 1;
    case 'int':
    case 'decimal':
    case 'float': {
      const range = numberRange(column.name, row);
      const scale = kind.type === 'int' ? 0 : kind.type === 'decimal' ? kind.scale : range.money ? 2 : 3;
      const limit = kind.type === 'int' ? kind.max : kind.type === 'decimal' ? 10 ** (kind.precision - kind.scale) - 10 ** -kind.scale : Infinity;
      // A whole number that has to be unique counts, which cannot repeat.
      if (unique && kind.type === 'int') return Math.min(row + 1, limit);
      const high = Math.min(range.high, limit);
      const low = Math.min(range.low, high);
      const raw = range.money || kind.type !== 'int' ? low + r() * (high - low) : between(r, low, high);
      let value = Number(raw.toFixed(scale));
      while (unique && taken.has(value) && value < limit) value = Number((value + 10 ** -scale).toFixed(scale));
      return value;
    }
    case 'bool':
      return r() < trueChance(column.name);
    case 'uuid': {
      const h = randomChars(r, HEX, 32);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${pick(r, ['8', '9', 'a', 'b'])}${h.slice(17, 20)}-${h.slice(20)}`;
    }
    case 'text': {
      const text = textFor({ r, row, column: column.name, noun: c.noun, person: c.person });
      return unique ? distinctText(text, row, taken, kind.max) : kind.max === null ? text : text.slice(0, kind.max);
    }
    case 'timestamp':
    case 'date':
    case 'time': {
      let ms = momentFor(r, column.name);
      // A row is updated after it was created.
      const created = /^(updated|modified)/i.test(column.name) ? [...c.stamps].find(([name]) => /^created/i.test(name)) : undefined;
      if (created) ms = created[1] + Math.floor(r() * 30 * DAY);
      c.stamps.set(column.name, ms);
      return formatMoment(ms, kind.type);
    }
    case 'year':
      return between(r, 1990, 2025);
    case 'json':
      return JSON.stringify({ sample: true, n: row + 1 });
    case 'binary':
      return { kind: 'binary', hex: randomChars(r, HEX, 2 * (kind.bytes ?? 8)) };
    case 'enum':
      return pick(r, kind.options);
    case 'ip':
      return `10.${between(r, 0, 255)}.${between(r, 0, 255)}.${between(r, 1, 254)}`;
    case 'interval':
      return `${between(r, 1, 30)} days`;
    case 'array':
      return '{}';
    case 'unknown':
      return 'sample';
  }
}

/** The rows of the tables that are made, by table name: what a foreign key picks its value from. */
type Made = ReadonlyMap<string, Pick<SeedTable, 'columns' | 'rows'>>;

/**
 * The value of a foreign key column: the value of the referenced column in a row that exists, or
 * null when the column may be empty. Undefined when it cannot be either: the table it references
 * has no rows. `values` are the other values of the row being made, for a table that references itself.
 */
function referenced(column: Column, table: Table, made: Made, own: Pick<SeedTable, 'columns' | 'rows'>, values: readonly SeedValue[], r: Random): SeedValue | undefined {
  const fk = column.fk;
  if (!fk) return null;
  const itself = fk.table === table.name;
  const source = itself ? own : made.get(fk.table);
  const at = source?.columns.findIndex((c) => c.name === fk.column) ?? -1;
  const candidates = source && at >= 0 ? source.rows.map((row) => row[at]) : [];
  if (column.nullable && (!candidates.length || r() < (itself ? ROOT_CHANCE : NULL_CHANCE))) return null;
  if (candidates.length) return pick(r, candidates);
  // The first row of a table that references itself, and cannot be empty, references itself.
  const mine = itself ? values[own.columns.findIndex((c) => c.name === fk.column)] : undefined;
  return mine === undefined || mine === null ? undefined : mine;
}

/** The columns that have a name: a column without one is not written. */
const named = (columns: readonly Column[]) => columns.filter((c) => c.name.trim());

/** The rows of one table, and why it got fewer than asked. */
function fillTable(table: Table, wanted: number, seed: number, made: Made): { table: SeedTable | null; notes: string[] } {
  const columns = named(table.columns);
  const notes: string[] = [];
  if (!columns.length) return { table: null, notes };
  const r = randomFrom(hashText(`${seed}|${table.name}`));
  const kinds = columns.map((c) => columnKind(c.type));
  const sets = uniqueSets(table);
  const single = new Set(sets.filter((s) => s.length === 1).map((s) => s[0]));
  const members = sets.map((set) => set.map((name) => columns.findIndex((c) => c.name === name)));
  const noun = singular(table.name.replace(/_/g, ' '));
  const person = PEOPLE.test(table.name);
  const rows: SeedValue[][] = [];
  const own = { columns, rows };
  const seen = sets.map(() => new Set<string>());
  const takenBy = columns.map(() => new Set<unknown>());

  for (let row = 0; row < wanted; row++) {
    let values: SeedValue[] | null = null;
    for (let attempt = 0; attempt < RETRIES && !values; attempt++) {
      const context: RowContext = { r, row, noun, person, stamps: new Map() };
      const next: SeedValue[] = new Array<SeedValue>(columns.length).fill(null);
      // The columns that reference another row come last: a table that references itself needs the rest of its row.
      for (const [k, column] of columns.entries()) {
        if (column.fk) continue;
        const mayBeEmpty = column.nullable && !column.pk && !single.has(column.name) && kinds[k].type !== 'serial';
        next[k] = mayBeEmpty && (r() < NULL_CHANCE || /^deleted/i.test(column.name)) ? null : valueOf(column, kinds[k], single.has(column.name), takenBy[k], context);
      }
      for (const [k, column] of columns.entries()) {
        if (!column.fk) continue;
        const value = referenced(column, table, made, own, next, r);
        if (value === undefined) {
          notes.push(`Table ${table.name} was left without rows: ${table.name}.${column.name} references ${column.fk.table}.${column.fk.column}, which has no rows to reference.`);
          return { table: null, notes };
        }
        next[k] = value;
      }
      // A set with an empty column does not repeat: empty values are not equal to each other.
      const tuples = members.map((at) => (at.some((k) => next[k] === null) ? null : JSON.stringify(at.map((k) => next[k]))));
      if (tuples.every((tuple, i) => tuple === null || !seen[i].has(tuple))) {
        tuples.forEach((tuple, i) => tuple !== null && seen[i].add(tuple));
        next.forEach((value, k) => takenBy[k].add(value));
        values = next;
      }
    }
    if (!values) {
      notes.push(`Table ${table.name} got ${rows.length} of ${wanted} rows: no more values could be found that stay unique.`);
      break;
    }
    rows.push(values);
  }
  for (const [k, column] of columns.entries()) {
    if (kinds[k].type === 'unknown' && !column.nullable && !column.default?.trim()) {
      notes.push(`${table.name}.${column.name} has the type ${column.type || '(none)'}, which has no sample value: it gets the text 'sample'.`);
    }
  }
  if (!rows.length) return { table: null, notes };
  const counters = columns.filter((_, k) => kinds[k].type === 'serial').map((c) => c.name);
  return { table: { table, columns, rows, counters }, notes };
}

/**
 * Sample rows for `tables`: up to `options.rows` for each. A table whose foreign keys cannot be
 * satisfied, such as one that references an empty table, gets none and is named in the notes.
 */
export function generateSeed(tables: readonly Table[], given: Partial<SeedOptions> = {}): SeedData {
  const options = { ...DEFAULT_SEED_OPTIONS, ...given };
  const wanted = clampRows(options.rows);
  const notes: string[] = [];
  const made = new Map<string, SeedTable>();
  const order: SeedTable[] = [];
  for (const table of inOrder(tables)) {
    const filled = fillTable(table, wanted, options.seed, made);
    notes.push(...filled.notes);
    if (!filled.table) continue;
    made.set(table.name, filled.table);
    order.push(filled.table);
  }
  return { tables: order, notes };
}
