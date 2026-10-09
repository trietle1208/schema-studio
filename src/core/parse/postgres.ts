import {
  parse as parseStatement,
  type AlterTableStatement,
  type CommentStatement,
  type CreateColumnDef,
  type CreateIndexStatement,
  type CreateTableStatement,
  type DataTypeDef,
  type DropStatement,
  type PGNode,
  type Statement as Ast,
  type TableConstraint,
  type TableReference,
} from 'pgsql-ast-parser';
import { anyOf, t, type MessageKey } from '../i18n';
import type { IndexType, OnDelete } from '../model';
import {
  closing,
  Failure,
  finishTables,
  isName,
  isSymbol,
  isWord,
  PRIMARY_KEY,
  resolveForeignKeys,
  type DraftColumn,
  type DraftTable,
} from './draft';
import { lineCounter, splitStatements, type Statement, type Token } from './lexer';
import type { ParseError, ParseOutcome, SqlParser } from './index';

// PostgreSQL DDL → model. The script is split into statements here, so that a dump's SET, CREATE
// SEQUENCE or CREATE FUNCTION never reach the grammar and every error can name its line. The
// statements that define tables are then read by pgsql-ast-parser, after the clauses it does not
// know (PARTITION BY, DEFERRABLE, INCLUDE…) are blanked out, which keeps every offset in place.

const DEFAULT_SCHEMA = 'public';
const DEFAULT_INDEX_METHOD = 'btree';

/** What is written after such a reference, as the grammar wants a column list. */
const KEY_LIST = ` ("${PRIMARY_KEY}")`;

type Kind = 'create table' | 'create index' | 'alter table' | 'comment' | 'drop table';

/** The spellings pg_dump and psql use for the types the type picker lists under a shorter name. */
const TYPE_ALIASES: Record<string, string> = {
  'character varying': 'VARCHAR',
  character: 'CHAR',
  'timestamp without time zone': 'TIMESTAMP',
  'timestamp with time zone': 'TIMESTAMPTZ',
  'time without time zone': 'TIME',
  'time with time zone': 'TIMETZ',
  'bit varying': 'VARBIT',
  int: 'INTEGER',
  int2: 'SMALLINT',
  int4: 'INTEGER',
  int8: 'BIGINT',
  serial2: 'SMALLSERIAL',
  serial4: 'SERIAL',
  serial8: 'BIGSERIAL',
  float4: 'REAL',
  float8: 'DOUBLE PRECISION',
  bool: 'BOOLEAN',
};

/** The auto-incrementing type an integer column becomes when a sequence or an identity feeds it. */
const SERIAL_OF: Record<string, string> = { SMALLINT: 'SMALLSERIAL', INTEGER: 'SERIAL', BIGINT: 'BIGSERIAL' };
const SERIAL_TYPES = new Set(Object.values(SERIAL_OF));

const ON_DELETE: Record<string, OnDelete> = {
  cascade: 'CASCADE',
  restrict: 'RESTRICT',
  'set null': 'SET NULL',
  'no action': 'NO ACTION',
};

/** The words that end a DEFAULT expression: each starts the next column constraint. */
const AFTER_DEFAULT = new Set([
  'NOT',
  'NULL',
  'PRIMARY',
  'UNIQUE',
  'REFERENCES',
  'CHECK',
  'CONSTRAINT',
  'GENERATED',
  'COLLATE',
  'DEFERRABLE',
  'INITIALLY',
]);

/** The words a table constraint starts with, where a column definition starts with a name. */
const CONSTRAINT_START = new Set(['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK', 'EXCLUDE', 'LIKE']);

const TOKEN_NAMES: Record<string, string> = {
  comma: '`,`',
  lparen: '`(`',
  rparen: '`)`',
  semicolon: '`;`',
  dot: '`.`',
};

/** The tokens that are named by what they are, each with the message that says so. */
const TOKEN_KINDS: Record<string, MessageKey & `parse.token.${string}`> = {
  word: 'parse.token.name',
  quoted_word: 'parse.token.name',
  int: 'parse.token.number',
  float: 'parse.token.number',
  string: 'parse.token.string',
};

/** What is known of the script so far. */
interface Context {
  sql: string;
  lineOf: (offset: number) => number;
  tables: Map<string, DraftTable>;
  /** Every index and key name in use: PostgreSQL keeps them unique within a schema. */
  indexNames: Set<string>;
  warnings: string[];
  /** CHECK constraints seen; the model has no place for them. */
  checks: number;
}

/** A statement as the grammar is given it, and the way back from its offsets to the script's. */
interface Source {
  statement: Statement;
  text: string;
  /** The script offset of a node, or of the statement when the node carries no location. */
  at: (node: PGNode | undefined) => number;
  /** The script offset of an offset into `text`. */
  toScript: (offset: number) => number;
}

function fail(ctx: Context, message: string, offset: number): never {
  throw new Failure({ message, line: ctx.lineOf(offset) });
}

/** A name as the database knows it: lower case, or as it is written when it is in quotes. */
function nameOf(token: Token): string {
  return token.kind === 'quoted' ? token.text.slice(1, -1).replace(/""/g, '"') : token.text.toLowerCase();
}

/** What a statement is, by its first words; null for the ones that do not define tables. */
function kindOf(tokens: Token[]): Kind | null {
  const word = (i: number) => (tokens[i]?.kind === 'word' ? tokens[i].upper : '');
  if (word(0) === 'CREATE') {
    let i = 1;
    while (['GLOBAL', 'LOCAL', 'TEMP', 'TEMPORARY', 'UNLOGGED'].includes(word(i))) i++;
    if (word(i) === 'TABLE') return 'create table';
    if (word(1) === 'INDEX' || (word(1) === 'UNIQUE' && word(2) === 'INDEX')) return 'create index';
  }
  if (word(0) === 'ALTER' && word(1) === 'TABLE') return 'alter table';
  if (word(0) === 'COMMENT' && word(1) === 'ON' && (word(2) === 'TABLE' || word(2) === 'COLUMN')) return 'comment';
  if (word(0) === 'DROP' && word(1) === 'TABLE') return 'drop table';
  return null;
}

/** The index of the `(` that opens the column list of a CREATE TABLE: the one right after its name. Else -1. */
function columnList(tokens: Token[]): number {
  let i = tokens.findIndex((t) => isWord(t, 'TABLE')) + 1;
  if (isWord(tokens[i], 'IF') && isWord(tokens[i + 1], 'NOT') && isWord(tokens[i + 2], 'EXISTS')) i += 3;
  if (!isName(tokens[i])) return -1;
  // The name may be written as schema.table.
  i += isSymbol(tokens[i + 1], '.') && isName(tokens[i + 2]) ? 3 : 1;
  return isSymbol(tokens[i], '(') ? i : -1;
}

/** `CREATE TABLE t ()` is valid PostgreSQL that the grammar refuses, so it is read here. Null for any other statement. */
function emptyTable(tokens: Token[]): CreateTableStatement | null {
  const open = columnList(tokens);
  if (open < 0 || !isSymbol(tokens[open + 1], ')')) return null;
  return {
    type: 'create table',
    name: { name: nameOf(tokens[open - 1]), ...(isSymbol(tokens[open - 2], '.') ? { schema: nameOf(tokens[open - 3]) } : {}) },
    columns: [],
    ...(tokens.some((t, i) => isWord(t, 'IF') && isWord(tokens[i + 1], 'NOT')) ? { ifNotExists: true } : {}),
  };
}

/**
 * The statement as the grammar can read it. Clauses it does not know are replaced by spaces, and a
 * reference that names no column gets a stand-in for the primary key. Null for a CREATE TABLE
 * that takes its columns from elsewhere (PARTITION OF, AS SELECT): there are none to import.
 */
function prepare(ctx: Context, statement: Statement, kind: Kind): Source | null {
  const { tokens } = statement;
  const blank = new Set<number>();
  const keyListAfter = new Set<number>();

  if (kind === 'create table') {
    const open = columnList(tokens);
    // A table made from another one has no column list. Any other statement without one is left to the grammar to refuse.
    const derived = tokens.some((t, i) => isWord(t, 'AS') || (isWord(t, 'PARTITION') && isWord(tokens[i + 1], 'OF')));
    if (open < 0 && derived) {
      ctx.warnings.push(t('parse.warn.noColumnList', { line: ctx.lineOf(statement.start) }));
      return null;
    }
    const close = open < 0 ? -1 : closing(tokens, open);
    if (close >= 0 && close < tokens.length - 1) {
      // Storage and partitioning say how the table is kept, not what is in it.
      const clause = isWord(tokens[close + 1], 'PARTITION') ? 'PARTITION BY' : tokens[close + 1].upper;
      ctx.warnings.push(t('parse.warn.unsupportedClause', { table: tokens[open - 1]?.text ?? '?', clause }));
      for (let i = close + 1; i < tokens.length; i++) blank.add(i);
    }
  }

  tokens.forEach((token, i) => {
    if (token.kind !== 'word' || blank.has(i)) return;
    const next = tokens[i + 1];
    if (kind === 'create index') {
      if (token.upper === 'ONLY' && isWord(tokens[i - 1], 'ON')) blank.add(i);
      // The columns an index carries along and its storage parameters are not part of the model.
      if ((token.upper === 'INCLUDE' || token.upper === 'WITH') && isSymbol(next, '(')) {
        const close = closing(tokens, i + 1);
        for (let j = i; j <= (close < 0 ? i : close); j++) blank.add(j);
      }
      if (token.upper === 'NULLS' && (isWord(next, 'DISTINCT') || isWord(tokens[i + 2], 'DISTINCT'))) {
        for (let j = i; !isWord(tokens[j - 1], 'DISTINCT'); j++) blank.add(j);
      }
      return;
    }
    if (token.upper === 'DEFERRABLE') {
      blank.add(i);
      if (isWord(tokens[i - 1], 'NOT')) blank.add(i - 1);
    }
    if (token.upper === 'INITIALLY' && next?.kind === 'word') blank.add(i).add(i + 1);
    if (token.upper === 'NOT' && isWord(next, 'VALID')) blank.add(i).add(i + 1);
    if (token.upper === 'NO' && isWord(next, 'INHERIT')) blank.add(i).add(i + 1);
    if (token.upper === 'REFERENCES' && isName(next)) {
      // The table may be written as schema.table.
      const name = isSymbol(tokens[i + 2], '.') && isName(tokens[i + 3]) ? i + 3 : i + 1;
      if (!isSymbol(tokens[name + 1], '(')) keyListAfter.add(name);
    }
  });

  let text = '';
  let from = statement.start;
  /** Where the key lists went in, as offsets into the statement as it was written. */
  const inserts: number[] = [];
  tokens.forEach((token, i) => {
    if (blank.has(i)) {
      text += ctx.sql.slice(from, token.start) + ' '.repeat(token.end - token.start);
      from = token.end;
    } else if (keyListAfter.has(i)) {
      text += ctx.sql.slice(from, token.end) + KEY_LIST;
      from = token.end;
      inserts.push(token.end - statement.start);
    }
  });
  text += ctx.sql.slice(from, statement.end);

  const toScript = (offset: number) => {
    let shift = 0;
    for (const insert of inserts) {
      const start = insert + shift;
      if (offset < start) break;
      if (offset < start + KEY_LIST.length) return statement.start + insert;
      shift += KEY_LIST.length;
    }
    return statement.start + offset - shift;
  };
  return {
    statement,
    text,
    toScript,
    at: (node) => (node?._location ? toScript(node._location.start) : statement.start),
  };
}

/** What the grammar would have accepted, when its message lists few enough tokens to be worth saying. */
function expectedTokens(message: string): string[] {
  const names = new Set<string>();
  for (const [, token] of message.matchAll(/- A "([a-z_]+)" token/g)) {
    if (token.startsWith('kw_')) names.add(`\`${token.slice(3).toUpperCase().replace(/_/g, ' ')}\``);
    else names.add(TOKEN_KINDS[token] ? t(TOKEN_KINDS[token]) : (TOKEN_NAMES[token] ?? ''));
  }
  names.delete('');
  return names.size <= 3 ? [...names] : [];
}

/** How many parentheses enclose each token. A parenthesis counts as inside the pair it belongs to. */
function depths(tokens: Token[]): number[] {
  let depth = 0;
  return tokens.map((t) => {
    if (isSymbol(t, '(')) return ++depth;
    if (isSymbol(t, ')')) return depth--;
    return depth;
  });
}

/** The offset into `text` at which the grammar gave up; undefined when it ran out of input. */
function stoppedAt(thrown: unknown, text: string): number | undefined {
  const token = (thrown as { token?: { offset?: number } }).token;
  if (typeof token?.offset === 'number') return token.offset;
  // For a character it cannot read at all, the grammar only says the line and the column.
  const place = /at line (\d+) col (\d+)/.exec(thrown instanceof Error ? thrown.message : '');
  if (!place) return undefined;
  let start = 0;
  for (let line = 1; line < Number(place[1]); line++) start = text.indexOf('\n', start) + 1;
  return start + Number(place[2]) - 1;
}

/** Turns what the grammar threw into an error that names a line and, where it can, the fix. */
function syntaxError(ctx: Context, source: Source, kind: Kind, thrown: unknown): ParseError {
  const { tokens } = source.statement;
  const near = (offset: number) => t('parse.near', { line: ctx.lineOf(offset) });
  const rest = t('parse.rest');
  const found = stoppedAt(thrown, source.text);

  if (found === undefined) {
    const last = tokens[tokens.length - 1];
    return {
      message: near(last.start),
      line: ctx.lineOf(last.start),
      detail: `${t('parse.incomplete')} ${rest}`,
    };
  }

  const offset = source.toScript(found);
  // The token the grammar stopped at; past the end of the statement, its last one.
  const reached = tokens.findIndex((t) => t.end > offset);
  const index = reached < 0 ? tokens.length - 1 : reached;
  const token = tokens[index];
  const line = ctx.lineOf(token.start);
  // The first token of the line the error is on, and the token before that line.
  let first = index;
  while (first > 0 && ctx.lineOf(tokens[first - 1].start) === line) first--;
  const before = tokens[first - 1];

  // A definition that starts on a new line while the one above it has not ended: a comma is missing.
  if (kind === 'create table' && before && index - first <= 1 && isName(tokens[first])) {
    const depth = depths(tokens);
    if (depth[first] === 1 && !isSymbol(before, ',') && !isSymbol(before, '(')) {
      let start = first - 1;
      while (start > 0 && !(depth[start - 1] === 1 && (isSymbol(tokens[start - 1], ',') || isSymbol(tokens[start - 1], '(')))) {
        start--;
      }
      const definition = tokens[start];
      const after = CONSTRAINT_START.has(definition.upper) ? t('parse.thisConstraint') : t('parse.columnDefinition', { name: definition.text });
      return {
        message: near(before.start),
        line: ctx.lineOf(before.start),
        detail: `${t('parse.expectedAfter', { definition: after })} ${rest}`,
      };
    }
  }

  // A backtick is no part of PostgreSQL's SQL, and a message cannot show one: what it puts in backticks is set as code.
  if (token.text === '`') {
    return {
      message: near(token.start),
      line,
      detail: t('parse.backticks'),
    };
  }

  const expected = expectedTokens(thrown instanceof Error ? thrown.message : '');
  const detail = [
    t('parse.unexpected', { token: token.text }),
    isSymbol(token, ')') && isSymbol(tokens[index - 1], ',')
      ? t('parse.removeComma')
      : expected.length
        ? t('parse.expected', { expected: anyOf(expected) })
        : '',
    rest,
  ];
  // A `)` or `;` that opens its line is unexpected because of what the line above ends with.
  const where = index === first && before && token.kind === 'symbol' ? before.start : token.start;
  return { message: near(where), line: ctx.lineOf(where), detail: detail.filter(Boolean).join(' ') };
}

/** A type as the model writes it: upper case, the short name, arguments without spaces. */
function typeName(type: DataTypeDef): string {
  if (type.kind === 'array') return `${typeName(type.arrayOf)}[]`;
  // A quoted type name keeps its case, and its quotes with it.
  const name = type.doubleQuoted ? `"${type.name}"` : (TYPE_ALIASES[type.name] ?? type.name.toUpperCase());
  const schema = type.schema && type.schema !== DEFAULT_SCHEMA && type.schema !== 'pg_catalog' ? `${type.schema.toUpperCase()}.` : '';
  return `${schema}${name}${type.config?.length ? `(${type.config.join(',')})` : ''}`;
}

/**
 * The expression of the first DEFAULT at or after `from`, as it is written in the script. The
 * grammar's own locations cut expressions short, so the tokens are followed instead.
 */
function defaultText(ctx: Context, tokens: Token[], from: number): string | undefined {
  const keyword = tokens.findIndex((t) => t.start >= from && isWord(t, 'DEFAULT'));
  if (keyword < 0 || keyword + 1 >= tokens.length) return undefined;
  let depth = 0;
  let last = keyword + 1;
  for (let i = keyword + 1; i < tokens.length; i++) {
    const token = tokens[i];
    const opens = isSymbol(token, '(') || isSymbol(token, '[');
    const closes = isSymbol(token, ')') || isSymbol(token, ']');
    if (closes && depth === 0) break;
    // The first token is the expression itself, even when it is NULL.
    if (depth === 0 && i > keyword + 1 && (isSymbol(token, ',') || (token.kind === 'word' && AFTER_DEFAULT.has(token.upper)))) {
      break;
    }
    if (opens) depth++;
    if (closes) depth--;
    last = i;
  }
  return ctx.sql.slice(tokens[keyword + 1].start, tokens[last].end);
}

function columnOf(ctx: Context, table: DraftTable, name: string, offset: number): DraftColumn {
  const column = table.columns.find((c) => c.name === name);
  if (!column) fail(ctx, t('validate.columnMissing', { name, table: table.name }), offset);
  return column;
}

/** An integer column fed by a sequence or an identity is what the model calls SERIAL. */
function makeSerial(column: DraftColumn): boolean {
  const serial = SERIAL_OF[column.type];
  if (!serial) return false;
  column.type = serial;
  delete column.default;
  return true;
}

function setDefault(column: DraftColumn, text: string | undefined) {
  if (text === undefined) return;
  // pg_dump writes a serial column as an integer whose default reads its sequence.
  if (/^nextval\s*\(/i.test(text) && makeSerial(column)) return;
  column.default = text;
}

function addIndex(
  ctx: Context,
  table: DraftTable,
  index: { type: IndexType; columns: string[]; name: string | undefined; fallback: string; using?: string; partial?: boolean },
  offset: number,
) {
  const columns = index.columns.map((name) => columnOf(ctx, table, name, offset));
  let name = index.name;
  if (name === undefined) {
    // An unnamed index gets the name PostgreSQL would give it.
    name = index.fallback;
    for (let n = 1; ctx.indexNames.has(name); n++) name = `${index.fallback}${n}`;
  } else if (ctx.indexNames.has(name)) {
    fail(ctx, t('validate.indexExists', { name }), offset);
  }
  ctx.indexNames.add(name);
  table.indexes.push({ name, type: index.type, using: index.using ?? DEFAULT_INDEX_METHOD, columns: index.columns });
  // A partial index does not make the whole column unique.
  if (index.type === 'UNIQUE' && columns.length === 1 && !index.partial) columns[0].unique = true;
}

function setPrimaryKey(ctx: Context, table: DraftTable, columns: string[], name: string | undefined, offset: number) {
  if (table.indexes.some((i) => i.type === 'PRIMARY KEY')) fail(ctx, t('validate.primaryKeyExists', { name: table.name }), offset);
  for (const column of columns.map((c) => columnOf(ctx, table, c, offset))) {
    column.pk = true;
    column.nullable = false;
  }
  addIndex(ctx, table, { type: 'PRIMARY KEY', columns, name, fallback: `${table.name}_pkey` }, offset);
}

function setForeignKey(ctx: Context, table: DraftTable, columns: string[], reference: TableReference, offset: number) {
  if (columns.length !== 1 || reference.foreignColumns.length !== 1) {
    // A column of the model references one column.
    ctx.warnings.push(t('parse.warn.compositeForeignKey', { table: table.name, columns: columns.map((c) => `\`${c}\``).join(', ') }));
    return;
  }
  const column = columnOf(ctx, table, columns[0], offset);
  const path = `${table.name}.${column.name}`;
  if (column.fk) ctx.warnings.push(t('parse.warn.severalForeignKeys', { column: path }));
  if (reference.onDelete === 'set default') ctx.warnings.push(t('parse.warn.setDefault', { column: path }));
  column.fk = {
    table: reference.foreignTable.name,
    column: reference.foreignColumns[0].name,
    // Without the clause PostgreSQL takes no action.
    onDelete: ON_DELETE[reference.onDelete ?? 'no action'] ?? 'NO ACTION',
  };
}

function addColumn(ctx: Context, source: Source, table: DraftTable, def: CreateColumnDef) {
  const name = def.name.name;
  if (table.columns.some((c) => c.name === name)) {
    fail(ctx, t('validate.columnExists', { name, table: table.name }), source.at(def.name));
  }
  const type = typeName(def.dataType);
  // SERIAL is NOT NULL without saying so.
  const column: DraftColumn = { name, type, nullable: !SERIAL_TYPES.has(type), pk: false, unique: false };
  table.columns.push(column);

  for (const constraint of def.constraints ?? []) {
    const offset = source.at(constraint);
    switch (constraint.type) {
      case 'not null':
        column.nullable = false;
        break;
      case 'null':
        column.nullable = true;
        break;
      case 'primary key':
        setPrimaryKey(ctx, table, [name], constraint.constraintName?.name, offset);
        break;
      case 'unique':
        addIndex(
          ctx,
          table,
          { type: 'UNIQUE', columns: [name], name: constraint.constraintName?.name, fallback: `${table.name}_${name}_key` },
          offset,
        );
        break;
      case 'default':
        setDefault(column, defaultText(ctx, source.statement.tokens, constraint._location ? offset : source.at(def)));
        break;
      case 'reference':
        setForeignKey(ctx, table, [name], constraint, offset);
        break;
      case 'check':
        ctx.checks++;
        break;
      case 'add generated':
        if (constraint.expression) {
          ctx.warnings.push(t('parse.warn.generatedColumn', { column: `${table.name}.${name}` }));
        } else if (makeSerial(column)) {
          // An identity column is NOT NULL as well.
          column.nullable = false;
        }
        break;
    }
  }
}

function addConstraint(ctx: Context, source: Source, table: DraftTable, constraint: TableConstraint) {
  const offset = source.at(constraint);
  switch (constraint.type) {
    case 'primary key':
      setPrimaryKey(
        ctx,
        table,
        constraint.columns.map((c) => c.name),
        constraint.constraintName?.name,
        offset,
      );
      break;
    case 'unique': {
      const columns = constraint.columns.map((c) => c.name);
      addIndex(
        ctx,
        table,
        { type: 'UNIQUE', columns, name: constraint.constraintName?.name, fallback: `${table.name}_${columns.join('_')}_key` },
        offset,
      );
      break;
    }
    case 'foreign key':
      setForeignKey(
        ctx,
        table,
        constraint.localColumns.map((c) => c.name),
        constraint,
        offset,
      );
      break;
    case 'check':
      ctx.checks++;
      break;
  }
}

function createTable(ctx: Context, source: Source, ast: CreateTableStatement) {
  const name = ast.name.name;
  if (ctx.tables.has(name)) {
    if (ast.ifNotExists) return;
    fail(ctx, t('validate.tableExists', { name }), source.at(ast.name));
  }
  const table: DraftTable = { name, schema: ast.name.schema ?? DEFAULT_SCHEMA, comment: '', columns: [], indexes: [] };
  for (const def of ast.columns) {
    if (def.kind === 'column') addColumn(ctx, source, table, def);
    else ctx.warnings.push(t('parse.warn.likeColumns', { table: name, source: def.like.name }));
  }
  for (const constraint of ast.constraints ?? []) addConstraint(ctx, source, table, constraint);
  ctx.tables.set(name, table);
}

/** The table a later statement is about. A statement about a table the script does not define is skipped. */
function knownTable(ctx: Context, source: Source, statement: string, name: string): DraftTable | undefined {
  const table = ctx.tables.get(name);
  if (!table) {
    ctx.warnings.push(t('parse.warn.unknownTable', { line: ctx.lineOf(source.statement.start), statement, table: name }));
  }
  return table;
}

function alterTable(ctx: Context, source: Source, ast: AlterTableStatement) {
  const table = knownTable(ctx, source, 'ALTER TABLE', ast.table.name);
  if (!table) return;
  for (const change of ast.changes) {
    switch (change.type) {
      case 'add constraint':
        addConstraint(ctx, source, table, change.constraint);
        break;
      case 'add column':
        if (change.ifNotExists && table.columns.some((c) => c.name === change.column.name.name)) break;
        addColumn(ctx, source, table, change.column);
        break;
      case 'alter column': {
        const column = columnOf(ctx, table, change.column.name, source.at(change.column));
        const alter = change.alter;
        if (alter.type === 'set default') setDefault(column, defaultText(ctx, source.statement.tokens, source.at(change)));
        else if (alter.type === 'drop default') delete column.default;
        else if (alter.type === 'set not null') column.nullable = false;
        else if (alter.type === 'drop not null') column.nullable = !column.pk;
        else if (alter.type === 'set type') column.type = typeName(alter.dataType);
        else if (alter.type === 'add generated' && !alter.expression && makeSerial(column)) column.nullable = false;
        break;
      }
      case 'owner':
        break;
      default:
        ctx.warnings.push(
          t('parse.warn.notImported', { line: ctx.lineOf(source.at(change)), statement: `ALTER TABLE ${table.name} ${change.type.toUpperCase()}` }),
        );
    }
  }
}

function createIndex(ctx: Context, source: Source, ast: CreateIndexStatement) {
  const table = knownTable(ctx, source, 'CREATE INDEX', ast.table.name);
  if (!table) return;
  const name = ast.indexName?.name;
  if (ast.ifNotExists && name !== undefined && ctx.indexNames.has(name)) return;
  const named = { index: name ?? t('parse.warn.unnamedIndex'), table: table.name };

  const columns: string[] = [];
  for (const { expression } of ast.expressions) {
    // An index of the model lists columns.
    if (expression.type !== 'ref' || expression.table) {
      ctx.warnings.push(t('parse.warn.indexExpression', named));
      return;
    }
    columns.push(expression.name);
  }
  if (ast.where) ctx.warnings.push(t('parse.warn.indexWhere', named));
  addIndex(
    ctx,
    table,
    {
      type: ast.unique ? 'UNIQUE' : 'INDEX',
      columns,
      name,
      fallback: `${table.name}_${columns.join('_')}_idx`,
      using: ast.using?.name.toLowerCase(),
      partial: !!ast.where,
    },
    source.at(ast.indexName ?? ast.table),
  );
}

function comment(ctx: Context, source: Source, ast: CommentStatement) {
  const on = ast.on;
  if (on.type === 'table') {
    const table = knownTable(ctx, source, 'COMMENT ON TABLE', on.name.name);
    if (table) table.comment = ast.comment;
  } else if (on.type === 'column') {
    const column = knownTable(ctx, source, 'COMMENT ON COLUMN', on.column.table)?.columns.find((c) => c.name === on.column.column);
    if (column) column.comment = ast.comment;
  }
}

function dropTable(ctx: Context, ast: DropStatement) {
  for (const { name } of ast.names) {
    for (const index of ctx.tables.get(name)?.indexes ?? []) ctx.indexNames.delete(index.name);
    ctx.tables.delete(name);
  }
}

/** Reads one statement into the context. Returns false for a statement that does not define tables. */
function read(ctx: Context, statement: Statement): boolean {
  const kind = kindOf(statement.tokens);
  if (!kind) return false;
  const source = prepare(ctx, statement, kind);
  if (!source) return true;

  let ast: Ast | undefined = (kind === 'create table' && emptyTable(statement.tokens)) || undefined;
  try {
    if (!ast) [ast] = parseStatement(source.text, { locationTracking: true });
  } catch (thrown) {
    // A table, an index or a constraint that cannot be read would be missing from the import, so
    // that stops it. The many other forms of ALTER TABLE, COMMENT and DROP are not worth an error.
    const defines =
      kind === 'create table' || kind === 'create index' || (kind === 'alter table' && statement.tokens.some((t) => isWord(t, 'ADD')));
    if (defines) throw new Failure(syntaxError(ctx, source, kind, thrown));
    ctx.warnings.push(t('parse.warn.unsupportedStatement', { line: ctx.lineOf(statement.start), statement: kind.toUpperCase() }));
    return true;
  }

  if (ast?.type === 'create table') createTable(ctx, source, ast);
  else if (ast?.type === 'alter table') alterTable(ctx, source, ast);
  else if (ast?.type === 'create index') createIndex(ctx, source, ast);
  else if (ast?.type === 'comment') comment(ctx, source, ast);
  else if (ast?.type === 'drop table') dropTable(ctx, ast);
  return true;
}

function parse(sql: string): ParseOutcome {
  const lineOf = lineCounter(sql);
  const ctx: Context = { sql, lineOf, tables: new Map(), indexNames: new Set(), warnings: [], checks: 0 };
  const script = splitStatements(sql);
  let skipped = 0;
  try {
    for (const statement of script.statements) {
      if (!read(ctx, statement)) skipped++;
    }
  } catch (thrown) {
    if (thrown instanceof Failure) return { ok: false, error: thrown.error };
    throw thrown;
  }
  if (script.error) {
    const line = lineOf(script.error.offset);
    return { ok: false, error: { message: t('parse.near', { line }), line, detail: script.error.message } };
  }

  resolveForeignKeys(ctx.tables, ctx.warnings);
  if (ctx.checks) ctx.warnings.push(t('parse.warn.checks', { count: ctx.checks }));
  return { ok: true, tables: finishTables(ctx.tables, ctx.warnings), warnings: ctx.warnings, skipped };
}

export const postgresParser: SqlParser = { engine: 'PostgreSQL', parse };
