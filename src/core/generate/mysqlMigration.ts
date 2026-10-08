import { primaryKey, uniqueColumns, writtenIndexes, writtenRelations, type PrimaryKey } from '../constraints';
import { widensMysqlType } from '../datatypes';
import { diffSchemas, schemaOf, type ColumnChange } from '../diff';
import type { Table } from '../model';
import { qualifiedName, type ColumnRef, type Relation } from '../relations';
import {
  addForeignKey,
  backsForeignKey,
  columnDefinition,
  columnList,
  createIndex,
  createTable,
  quoteName,
  quoteText,
  tableName,
  uniqueKeyName,
} from './mysql';
import { DEFAULT_GENERATE_OPTIONS, type DestructiveChange, type MigrateOptions, type Migration, type SqlMigrator } from './options';
import { foreignKeyName, note } from './script';

// Two versions of a schema → the MySQL statements that take a database from the first to the
// second. The database is taken to be what the DDL of the first version creates, so keys have the
// names that DDL gives them: `orders_user_id_fkey`, `users_email_key`.
//
// MySQL commits every statement of this kind as it runs, so the script is not a transaction. The
// order keeps every statement valid whatever the tables are: foreign keys and indexes that go are
// dropped first, then tables are dropped, created and altered, and what is new is added last.
//
// A foreign key stands in the way of more than in other engines: neither of its columns can
// change type under it, and the index it uses cannot go. Such a key is dropped and added again.
// MySQL also gives a foreign key an index of its own, named after it, when its column starts no
// other index; that index stays behind when the key is dropped, so it is dropped with it.

const NOT_ATOMIC = 'MySQL commits each statement as it runs: a migration that stops halfway is not rolled back.';

const text = (value: string | undefined) => value?.trim() ?? '';

/** A primary key has no name in MySQL: two are the same when they list the same columns in the same order. */
function samePrimaryKey(a: PrimaryKey | null, b: PrimaryKey | null): boolean {
  if (!a || !b) return a === b;
  return a.columns.length === b.columns.length && a.columns.every((name, i) => name === b.columns[i]);
}

/** Whether a key or an index of the table starts with the column, so that a foreign key on it uses that and gets no index of its own. */
function isIndexed(table: Table, column: string): boolean {
  const { indexes } = writtenIndexes(table);
  return (
    primaryKey(table)?.columns[0] === column ||
    uniqueColumns(table, indexes).includes(column) ||
    indexes.some((index) => backsForeignKey(index, column))
  );
}

function migrate(givenBefore: readonly Table[], givenAfter: readonly Table[], options: MigrateOptions = {}): Migration {
  // MySQL cannot create a table without columns: such a table is not there until it gets its first.
  const before = givenBefore.filter((t) => t.columns.length);
  const after = givenAfter.filter((t) => t.columns.length);
  const changes = diffSchemas(before, after);
  const is = new Map(after.map((t) => [t.name, t]));
  const was = new Map(before.map((t) => [t.name, t]));
  /** Groups of lines; a blank line goes between two groups. */
  const blocks: string[][] = [];
  const destructive: DestructiveChange[] = [];
  /** Records a change that deletes data and gives the line that says so above its statement. */
  const flag = (path: string, message: string) => {
    destructive.push({ path, message });
    return note(`Destructive: ${message}`);
  };

  const columnsOf = new Map<string, ColumnChange[]>();
  for (const change of changes.columns) columnsOf.set(change.table, [...(columnsOf.get(change.table) ?? []), change]);

  /** Whether what a foreign key needs of this column is taken from under it: its type changes, or an index that starts with it goes. */
  const disturbed = ({ table: name, column }: ColumnRef): boolean => {
    const old = was.get(name);
    const now = is.get(name);
    if (!old || !now) return false;
    const retyped = (columnsOf.get(name) ?? []).some((c) => c.op === 'mod' && c.after.name === column && c.before.type !== c.after.type);
    const keyWas = primaryKey(old);
    const unkeyed = keyWas?.columns[0] === column && !samePrimaryKey(keyWas, primaryKey(now));
    const unindexed = changes.indexes.some((c) => c.table === name && c.op !== 'add' && c.before.columns[0] === column);
    const lostUnique = uniqueColumns(old).includes(column) && !uniqueColumns(now).includes(column);
    return retyped || unkeyed || unindexed || lostUnique;
  };
  const changed = new Set(changes.relationships.map((c) => qualifiedName((c.op === 'del' ? c.before : c.after).from)));
  /** The foreign keys that are the same in both versions but cannot stay while the tables change. */
  const rebuilt = writtenRelations(after).filter((r) => !changed.has(qualifiedName(r.from)) && (disturbed(r.from) || disturbed(r.to)));

  // A table that moves to another database does so first, so that every later statement finds it there.
  for (const change of changes.tables) {
    if (change.op === 'mod' && schemaOf(change.before) !== schemaOf(change.after)) {
      blocks.push([`RENAME TABLE ${tableName(change.before)}`, `  TO ${tableName(change.after)};`]);
    }
  }

  // Foreign keys and indexes that go or change. Those of a dropped table go with it.
  const dropForeignKey = (relation: Relation) => {
    const table = is.get(relation.from.table);
    const old = was.get(relation.from.table);
    if (!table || !old) return;
    const name = quoteName(foreignKeyName(table.name, relation.from.column));
    const own = !isIndexed(old, relation.from.column);
    blocks.push([`ALTER TABLE ${tableName(table)}`, `  DROP FOREIGN KEY ${name}${own ? ',' : ';'}`, ...(own ? [`  DROP INDEX ${name};`] : [])]);
  };
  for (const change of changes.relationships) if (change.op !== 'add') dropForeignKey(change.before);
  for (const relation of rebuilt) dropForeignKey(relation);
  for (const change of changes.indexes) {
    const table = is.get(change.table);
    if (change.op !== 'add' && table) blocks.push([`DROP INDEX ${quoteName(change.before.name)} ON ${tableName(table)};`]);
  }

  // One statement drops every table that goes, so that foreign keys between them do not stand in the way.
  const gone = changes.tables.flatMap((change) => (change.op === 'del' ? [change.before] : []));
  if (gone.length) {
    blocks.push([
      ...gone.map((table) => flag(table.name, `Dropping ${table.name} deletes its data.`)),
      `DROP TABLE ${gone.map(tableName).join(', ')};`,
    ]);
  }
  for (const change of changes.tables) {
    if (change.op === 'add') blocks.push(createTable(change.after, writtenIndexes(change.after).indexes, DEFAULT_GENERATE_OPTIONS));
  }

  for (const table of after) {
    const old = was.get(table.name);
    if (!old) continue;
    const columns = columnsOf.get(table.name) ?? [];
    /** What goes above the ALTER TABLE, and its actions. */
    const notes: string[] = [];
    const actions: string[] = [];

    const dropped = new Set(columns.flatMap((c) => (c.op === 'del' ? [c.before.name] : [])));
    const keyWas = primaryKey(old);
    const keyIs = primaryKey(table);
    const rekeyed = !samePrimaryKey(keyWas, keyIs);
    const uniqueWas = uniqueColumns(old);
    const uniqueIs = uniqueColumns(table);
    const uniqueKey = (column: string) => quoteName(uniqueKeyName(table.name, column));

    if (rekeyed && keyWas) actions.push('DROP PRIMARY KEY');
    // The key of a column that is dropped goes with the column.
    for (const column of uniqueWas) {
      if (!uniqueIs.includes(column) && !dropped.has(column)) actions.push(`DROP INDEX ${uniqueKey(column)}`);
    }

    for (const change of columns) {
      if (change.op !== 'del') continue;
      const path = `${table.name}.${change.before.name}`;
      notes.push(flag(path, `Dropping ${path} deletes its data.`));
      actions.push(`DROP COLUMN ${quoteName(change.before.name)}`);
    }
    for (const change of columns) {
      if (change.op === 'add') actions.push(`ADD COLUMN ${quoteName(change.after.name)} ${columnDefinition(change.after)}`);
    }

    for (const change of columns) {
      if (change.op !== 'mod') continue;
      const { before: from, after: to } = change;
      // MySQL writes a column anew to change anything about it. Its keys are changed on their own.
      if (columnDefinition(from) === columnDefinition(to)) continue;
      const path = `${table.name}.${to.name}`;
      if (from.type !== to.type && !widensMysqlType(from.type, to.type)) {
        notes.push(flag(path, `Changing ${path} from ${from.type} to ${to.type} can fail or lose data.`));
      }
      actions.push(`MODIFY COLUMN ${quoteName(to.name)} ${columnDefinition(to)}`);
    }

    for (const column of uniqueIs) {
      if (!uniqueWas.includes(column)) actions.push(`ADD UNIQUE KEY ${uniqueKey(column)} ${columnList([column])}`);
    }
    if (rekeyed && keyIs) actions.push(`ADD PRIMARY KEY ${columnList(keyIs.columns)}`);
    if (text(old.comment) !== text(table.comment)) actions.push(`COMMENT = ${quoteText(text(table.comment))}`);

    if (actions.length) {
      blocks.push([...notes, `ALTER TABLE ${tableName(table)}`, ...actions.map((action, i) => `  ${action}${i < actions.length - 1 ? ',' : ';'}`)]);
    }
  }

  for (const change of changes.indexes) {
    const table = is.get(change.table);
    if (change.op !== 'del' && table) blocks.push(createIndex(table, change.after));
  }
  const addedKeys = [...changes.relationships.flatMap((change) => (change.op === 'del' ? [] : [change.after])), ...rebuilt];
  for (const relation of addedKeys) {
    const from = is.get(relation.from.table);
    const to = is.get(relation.to.table);
    if (from && to) blocks.push(addForeignKey(relation, from, to));
  }

  const statements = blocks.flat().filter((line) => line.endsWith(';')).length;
  const header = options.header?.length ? [options.header.map(note)] : [];
  const body = statements ? [[note(NOT_ATOMIC)], ...blocks] : [[note('No changes.')]];
  return { sql: `${[...header, ...body].map((lines) => lines.join('\n')).join('\n\n')}\n`, statements, destructive, atomic: false };
}

export const mysqlMigrator: SqlMigrator = { engine: 'MySQL', migrate };
