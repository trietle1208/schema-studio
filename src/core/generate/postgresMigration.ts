import { primaryKey, uniqueColumns, writtenIndexes, type PrimaryKey } from '../constraints';
import { serialType, widensType } from '../datatypes';
import { diffSchemas, schemaOf, type ColumnChange } from '../diff';
import type { Column, Table } from '../model';
import { DEFAULT_GENERATE_OPTIONS, type DestructiveChange, type MigrateOptions, type Migration, type SqlMigrator } from './options';
import { addForeignKey, columnList, createIndex, createTable, quoteName, quoteText, tableName } from './postgres';
import { foreignKeyName } from './script';

// Two versions of a schema → the PostgreSQL statements that take a database from the first to the
// second, in one transaction. The database is taken to be what the DDL of the first version
// creates, so constraints have the names that DDL gives them: `orders_user_id_fkey`,
// `users_email_key`, `orders_pkey`.
//
// The order keeps every statement valid whatever the tables are: foreign keys and indexes that go
// are dropped first, then tables are dropped, created and altered, and what is new is added last.

const text = (value: string | undefined) => value?.trim() ?? '';

/** A name in the schema of `table`: its index, its sequence. */
function inSchemaOf(table: Table, name: string): string {
  return schemaOf(table) === 'public' ? quoteName(name) : `${quoteName(schemaOf(table))}.${quoteName(name)}`;
}

function samePrimaryKey(a: PrimaryKey | null, b: PrimaryKey | null): boolean {
  if (!a || !b) return a === b;
  return a.name === b.name && a.columns.length === b.columns.length && a.columns.every((name, i) => name === b.columns[i]);
}

/** A column as ADD COLUMN writes it. Keys and unique constraints are added on their own. */
function columnDefinition(column: Column): string {
  const parts = [quoteName(column.name), column.type];
  if (!column.nullable) parts.push('NOT NULL');
  if (text(column.default)) parts.push(`DEFAULT ${text(column.default)}`);
  return parts.join(' ');
}

function commentOn(target: string, comment: string | undefined): string {
  return `COMMENT ON ${target} IS ${text(comment) ? quoteText(comment ?? '') : 'NULL'};`;
}

function migrate(before: readonly Table[], after: readonly Table[], options: MigrateOptions = {}): Migration {
  const changes = diffSchemas(before, after);
  const is = new Map(after.map((t) => [t.name, t]));
  const was = new Map(before.map((t) => [t.name, t]));
  /** Groups of lines; a blank line goes between two groups. */
  const blocks: string[][] = [];
  const destructive: DestructiveChange[] = [];
  /** Records a change that deletes data and gives the line that says so above its statement. */
  const flag = (path: string, message: string) => {
    destructive.push({ path, message });
    return `-- Destructive: ${message}`;
  };

  // A table that moves to another schema does so first, so that every later statement finds it there.
  for (const change of changes.tables) {
    if (change.op === 'mod' && schemaOf(change.before) !== schemaOf(change.after)) {
      blocks.push([`ALTER TABLE ${tableName(change.before)}`, `  SET SCHEMA ${quoteName(schemaOf(change.after))};`]);
    }
  }

  // Foreign keys and indexes that go or change. Those of a dropped table go with it.
  for (const change of changes.relationships) {
    const table = change.op === 'add' ? undefined : is.get(change.before.from.table);
    if (change.op === 'add' || !table) continue;
    blocks.push([`ALTER TABLE ${tableName(table)}`, `  DROP CONSTRAINT ${quoteName(foreignKeyName(table.name, change.before.from.column))};`]);
  }
  for (const change of changes.indexes) {
    const table = is.get(change.table);
    if (change.op !== 'add' && table) blocks.push([`DROP INDEX ${inSchemaOf(table, change.before.name)};`]);
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

  const columnsOf = new Map<string, ColumnChange[]>();
  for (const change of changes.columns) columnsOf.set(change.table, [...(columnsOf.get(change.table) ?? []), change]);

  for (const table of after) {
    const old = was.get(table.name);
    if (!old) continue;
    const name = tableName(table);
    const columns = columnsOf.get(table.name) ?? [];
    /** What goes above the ALTER TABLE, its actions, and the statements that can only come after it. */
    const notes: string[] = [];
    const actions: string[] = [];
    const later: string[][] = [];

    const dropped = new Set(columns.flatMap((c) => (c.op === 'del' ? [c.before.name] : [])));
    const keyWas = primaryKey(old);
    const keyIs = primaryKey(table);
    const rekeyed = !samePrimaryKey(keyWas, keyIs);
    const uniqueWas = uniqueColumns(old);
    const uniqueIs = uniqueColumns(table);
    const uniqueName = (column: string) => quoteName(`${table.name}_${column}_key`);

    if (rekeyed && keyWas) actions.push(`DROP CONSTRAINT ${quoteName(keyWas.name)}`);
    // The constraint of a column that is dropped goes with the column.
    for (const column of uniqueWas) {
      if (!uniqueIs.includes(column) && !dropped.has(column)) actions.push(`DROP CONSTRAINT ${uniqueName(column)}`);
    }

    for (const change of columns) {
      if (change.op !== 'del') continue;
      const path = `${table.name}.${change.before.name}`;
      notes.push(flag(path, `Dropping ${path} deletes its data.`));
      actions.push(`DROP COLUMN ${quoteName(change.before.name)}`);
    }
    for (const change of columns) if (change.op === 'add') actions.push(`ADD COLUMN ${columnDefinition(change.after)}`);

    for (const change of columns) {
      if (change.op !== 'mod') continue;
      const { before: from, after: to } = change;
      const column = quoteName(to.name);
      const path = `${table.name}.${to.name}`;
      // An auto-increment type is an integer with a sequence as its default; only the integer is a type to change to.
      const serialWas = serialType(from.type);
      const serialIs = serialType(to.type);
      const typeWas = serialWas ?? from.type;
      const typeIs = serialIs ?? to.type;
      const sequence = inSchemaOf(table, `${table.name}_${to.name}_seq`);

      if (typeWas !== typeIs) {
        const safe = widensType(typeWas, typeIs);
        if (!safe) notes.push(flag(path, `Changing ${path} from ${from.type} to ${to.type} can fail or lose data.`));
        actions.push(`ALTER COLUMN ${column} TYPE ${typeIs}${safe ? '' : ` USING ${column}::${typeIs}`}`);
        if (serialWas && serialIs) later.push([`ALTER SEQUENCE ${sequence} AS ${typeIs};`]);
      }
      if (!from.nullable !== !to.nullable) actions.push(`ALTER COLUMN ${column} ${to.nullable ? 'DROP' : 'SET'} NOT NULL`);

      if (serialWas && !serialIs && !text(to.default)) actions.push(`ALTER COLUMN ${column} DROP DEFAULT`);
      else if (text(from.default) !== text(to.default)) {
        actions.push(`ALTER COLUMN ${column} ${text(to.default) ? `SET DEFAULT ${text(to.default)}` : 'DROP DEFAULT'}`);
      }
      // Without its default the sequence of the column has no use.
      if (serialWas && !serialIs) later.push([`DROP SEQUENCE IF EXISTS ${sequence};`]);
      if (!serialWas && serialIs) {
        // The sequence goes on from the largest value the column already holds.
        later.push(
          [`CREATE SEQUENCE ${sequence} AS ${typeIs} OWNED BY ${name}.${column};`],
          [`SELECT setval(${quoteText(sequence)}, COALESCE(MAX(${column}), 0) + 1, false) FROM ${name};`],
          [`ALTER TABLE ${name}`, `  ALTER COLUMN ${column} SET DEFAULT nextval(${quoteText(sequence)});`],
        );
      }
    }

    for (const column of uniqueIs) {
      if (!uniqueWas.includes(column)) actions.push(`ADD CONSTRAINT ${uniqueName(column)} UNIQUE ${columnList([column])}`);
    }
    if (rekeyed && keyIs) actions.push(`ADD CONSTRAINT ${quoteName(keyIs.name)} PRIMARY KEY ${columnList(keyIs.columns)}`);

    if (actions.length) {
      blocks.push([...notes, `ALTER TABLE ${name}`, ...actions.map((action, i) => `  ${action}${i < actions.length - 1 ? ',' : ';'}`)]);
    }
    blocks.push(...later);
  }

  for (const change of changes.indexes) {
    const table = is.get(change.table);
    if (change.op !== 'del' && table) blocks.push(createIndex(table, change.after));
  }
  for (const change of changes.relationships) {
    if (change.op === 'del') continue;
    const from = is.get(change.after.from.table);
    const to = is.get(change.after.to.table);
    if (from && to) blocks.push(addForeignKey(change.after, from, to));
  }

  // Comments of the tables that were there before; a new table brings its own.
  const comments: string[] = [];
  for (const change of changes.tables) {
    if (change.op === 'mod' && text(change.before.comment) !== text(change.after.comment)) {
      comments.push(commentOn(`TABLE ${tableName(change.after)}`, change.after.comment));
    }
  }
  for (const change of changes.columns) {
    const table = is.get(change.table);
    if (change.op === 'del' || !table) continue;
    if (text(change.op === 'mod' ? change.before.comment : undefined) === text(change.after.comment)) continue;
    comments.push(commentOn(`COLUMN ${tableName(table)}.${quoteName(change.after.name)}`, change.after.comment));
  }
  if (comments.length) blocks.push(comments);

  const statements = blocks.flat().filter((line) => line.endsWith(';')).length;
  const header = options.header?.length ? [options.header.map((line) => `-- ${line}`)] : [];
  const body = statements ? [['BEGIN;'], ...blocks, ['COMMIT;']] : [['-- No changes.']];
  return { sql: `${[...header, ...body].map((lines) => lines.join('\n')).join('\n\n')}\n`, statements, destructive, atomic: true };
}

export const postgresMigrator: SqlMigrator = { engine: 'PostgreSQL', migrate };
