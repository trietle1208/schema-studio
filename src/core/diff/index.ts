import { writtenIndexes, writtenRelations } from '../constraints';
import { foreignKeyBlock, indexBlock, tableBlock } from '../generate/options';
import type { Column, DiffGroup, DiffItem, DiffOp, Index, Table } from '../model';
import { plural } from '../plural';
import { outgoingRelations, qualifiedName, type Relation } from '../relations';

// Compares two versions of a schema. Tables, columns and indexes are matched by name and a foreign
// key by its column, so a rename reads as one removed and one added. The comparison is about what
// ends up in a database: an index or foreign key that cannot be written (see core/constraints) or
// was only inferred is not part of it, and neither are the order of the columns and the canvas positions.

/** One thing that was added (`after`), removed (`before`) or changed (both). */
export type Change<T> = { op: 'add'; after: T } | { op: 'del'; before: T } | { op: 'mod'; before: T; after: T };

export type TableChange = Change<Table>;
/** `table` is the name of the table the column or index is on. */
export type ColumnChange = Change<Column> & { table: string };
export type IndexChange = Change<Index> & { table: string };
export type RelationChange = Change<Relation>;

export interface SchemaChanges {
  /** Tables that were added or removed, or whose own settings (comment, schema) changed. */
  tables: TableChange[];
  /** Columns of the tables that are in both versions. */
  columns: ColumnChange[];
  /** Indexes and foreign keys of every table, those of added and removed tables included. */
  indexes: IndexChange[];
  relationships: RelationChange[];
}

export interface DiffStats {
  added: number;
  modified: number;
  removed: number;
}

export const DIFF_GROUPS = ['Tables', 'Columns', 'Indexes', 'Relationships'] as const;
export type DiffGroupName = (typeof DIFF_GROUPS)[number];

const DEFAULT_SCHEMA = 'public';
const DEFAULT_INDEX_METHOD = 'btree';

const text = (value: string | undefined) => value?.trim() ?? '';
/** The schema a table is in; a table that names none is in `public`. */
export const schemaOf = (table: Table) => table.schema || DEFAULT_SCHEMA;

/** The value of whichever side a change has; for a changed thing, the new one. */
export function current<T>(change: Change<T>): T {
  return change.op === 'del' ? change.before : change.after;
}

function sameTable(a: Table, b: Table): boolean {
  return text(a.comment) === text(b.comment) && schemaOf(a) === schemaOf(b);
}

/** Whether two columns are the same but for their foreign key, which is compared as a relationship. */
function sameColumn(a: Column, b: Column): boolean {
  return (
    a.type === b.type &&
    !a.nullable === !b.nullable &&
    !a.pk === !b.pk &&
    !a.unique === !b.unique &&
    text(a.default) === text(b.default) &&
    text(a.comment) === text(b.comment)
  );
}

function sameIndex(a: Index, b: Index): boolean {
  return (
    a.type === b.type &&
    (a.using || DEFAULT_INDEX_METHOD) === (b.using || DEFAULT_INDEX_METHOD) &&
    a.columns.length === b.columns.length &&
    a.columns.every((name, i) => name === b.columns[i])
  );
}

function sameRelation(a: Relation, b: Relation): boolean {
  return a.to.table === b.to.table && a.to.column === b.to.column && a.onDelete === b.onDelete;
}

/** Matches two lists by `key`: what is only in `after` was added, only in `before` removed, and the rest changed unless `same`. */
function compare<T>(before: readonly T[], after: readonly T[], key: (item: T) => string, same: (a: T, b: T) => boolean): Change<T>[] {
  const was = new Map(before.map((item) => [key(item), item]));
  const is = new Set(after.map(key));
  const changes: Change<T>[] = [];
  for (const item of after) {
    const old = was.get(key(item));
    if (old === undefined) changes.push({ op: 'add', after: item });
    else if (!same(old, item)) changes.push({ op: 'mod', before: old, after: item });
  }
  for (const item of before) if (!is.has(key(item))) changes.push({ op: 'del', before: item });
  return changes;
}

/** What changed from `before` to `after`. */
export function diffSchemas(before: readonly Table[], after: readonly Table[]): SchemaChanges {
  const was = new Map(before.map((t) => [t.name, t]));
  const is = new Map(after.map((t) => [t.name, t]));
  const columns: ColumnChange[] = [];
  const indexes: IndexChange[] = [];

  const indexesOf = (table: Table | undefined) => (table ? writtenIndexes(table).indexes : []);
  // The tables of either version, those of `after` first, each once.
  for (const table of [...after, ...before.filter((t) => !is.has(t.name))]) {
    const old = was.get(table.name);
    const now = is.get(table.name);
    if (old && now) {
      for (const change of compare(old.columns, now.columns, (c) => c.name, sameColumn)) columns.push({ ...change, table: table.name });
    }
    for (const change of compare(indexesOf(old), indexesOf(now), (i) => i.name, sameIndex)) indexes.push({ ...change, table: table.name });
  }

  return {
    tables: compare(before, after, (t) => t.name, sameTable),
    columns,
    indexes,
    relationships: compare(writtenRelations(before), writtenRelations(after), (r) => qualifiedName(r.from), sameRelation),
  };
}

export function countChanges(changes: SchemaChanges): DiffStats {
  const stats: DiffStats = { added: 0, modified: 0, removed: 0 };
  for (const change of [...changes.tables, ...changes.columns, ...changes.indexes, ...changes.relationships]) {
    if (change.op === 'add') stats.added++;
    else if (change.op === 'mod') stats.modified++;
    else stats.removed++;
  }
  return stats;
}

export function totalChanges(stats: DiffStats): number {
  return stats.added + stats.modified + stats.removed;
}

// ---------------------------------------------------------------- how a change reads in the lists

/** A column as its row in the list describes it: `VARCHAR(100) NOT NULL UNIQUE`. */
export function describeColumn(column: Column): string {
  const parts = [column.type, column.pk ? 'PRIMARY KEY' : column.nullable ? 'NULL' : 'NOT NULL'];
  if (column.unique && !column.pk) parts.push('UNIQUE');
  if (text(column.default)) parts.push(`DEFAULT ${text(column.default)}`);
  return parts.join(' ');
}

/** An index as its row describes it: `btree (order_id)`, `UNIQUE btree (sku)`. */
export function describeIndex(index: Index): string {
  return `${index.type === 'UNIQUE' ? 'UNIQUE ' : ''}${index.using || DEFAULT_INDEX_METHOD} (${index.columns.join(', ')})`;
}

/** A foreign key as it is written everywhere: `orders.user_id → users.id`. */
export function describeRelation(relation: Relation): string {
  return `${qualifiedName(relation.from)} → ${qualifiedName(relation.to)}`;
}

function describeTable(table: Table): string {
  const parts = [plural(table.columns.length, 'column')];
  const indexes = table.indexes?.length ?? 0;
  const keys = outgoingRelations(table).filter((r) => !r.inferred).length;
  if (indexes) parts.push(plural(indexes, 'index', 'indexes'));
  if (keys) parts.push(plural(keys, 'foreign key'));
  return parts.join(' · ');
}

const flag = (was: boolean | undefined, is: boolean | undefined, name: string) =>
  !was === !is ? [] : [`${is ? 'added' : 'removed'} ${name}`];

/** What changed about a value that may be blank: `DEFAULT 0 → 1`, `added DEFAULT 1`, `removed DEFAULT`. */
function valueChange(was: string, is: string, name: string): string[] {
  if (was === is) return [];
  if (!was) return [`added ${name} ${is}`];
  return [is ? `${name} ${was} → ${is}` : `removed ${name}`];
}

function columnChanges(before: Column, after: Column): string {
  return [
    ...(before.type === after.type ? [] : [`${before.type} → ${after.type}`]),
    ...flag(before.pk, after.pk, 'PRIMARY KEY'),
    // A primary key is NOT NULL by itself, so becoming one says it already.
    ...(!before.nullable === !after.nullable || after.pk ? [] : [after.nullable ? 'NOT NULL → NULL' : 'NULL → NOT NULL']),
    ...flag(before.unique, after.unique, 'UNIQUE'),
    ...valueChange(text(before.default), text(after.default), 'DEFAULT'),
    ...(text(before.comment) === text(after.comment) ? [] : ['comment changed']),
  ].join(' · ');
}

function tableChanges(before: Table, after: Table): string {
  return [
    ...(schemaOf(before) === schemaOf(after) ? [] : [`schema ${schemaOf(before)} → ${schemaOf(after)}`]),
    ...(text(before.comment) === text(after.comment) ? [] : ['comment changed']),
  ].join(' · ');
}

function relationChanges(before: Relation, after: Relation): string {
  return [
    ...(qualifiedName(before.to) === qualifiedName(after.to) ? [] : [`${qualifiedName(before.to)} → ${qualifiedName(after.to)}`]),
    ...(before.onDelete === after.onDelete ? [] : [`ON DELETE ${before.onDelete} → ${after.onDelete}`]),
  ].join(' · ');
}

const ORDER: Record<DiffOp, number> = { add: 0, mod: 1, del: 2 };

/** Added first, then changed, then removed; within each, the order they were found in. */
function byOp(items: DiffItem[]): DiffItem[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => ORDER[a.item.op] - ORDER[b.item.op] || a.i - b.i)
    .map(({ item }) => item);
}

/** The changes as the lists show them, group by group. A group without changes is left out. */
export function diffGroups(changes: SchemaChanges): DiffGroup[] {
  const tables = changes.tables.map((c): DiffItem => ({
    op: c.op,
    path: current(c).name,
    detail: c.op === 'mod' ? tableChanges(c.before, c.after) : describeTable(current(c)),
    anchor: tableBlock(current(c).name),
  }));
  const columns = changes.columns.map((c): DiffItem => ({
    op: c.op,
    path: `${c.table}.${current(c).name}`,
    detail: c.op === 'mod' ? columnChanges(c.before, c.after) : describeColumn(current(c)),
    anchor: tableBlock(c.table),
  }));
  const indexes = changes.indexes.map((c): DiffItem => ({
    op: c.op,
    path: current(c).name,
    detail: c.op === 'mod' ? `${describeIndex(c.before)} → ${describeIndex(c.after)}` : describeIndex(current(c)),
    anchor: indexBlock(c.table, current(c).name),
  }));
  const relationships = changes.relationships.map((c): DiffItem => ({
    op: c.op,
    path: describeRelation(current(c)),
    detail: c.op === 'mod' ? relationChanges(c.before, c.after) : `ON DELETE ${current(c).onDelete}`,
    anchor: foreignKeyBlock(current(c).from.table, current(c).from.column),
  }));
  const groups: [DiffGroupName, DiffItem[]][] = [
    ['Tables', tables],
    ['Columns', columns],
    ['Indexes', indexes],
    ['Relationships', relationships],
  ];
  return groups.filter(([, items]) => items.length).map(([group, items]) => ({ group, items: byOp(items) }));
}
