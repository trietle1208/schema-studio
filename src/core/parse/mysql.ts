import { anyOf, t } from '../i18n';
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
import type { ParseOutcome, SqlParser } from './index';

// MySQL DDL → model. The statements that define tables are read here token by token, from left to
// right: that covers what mysqldump, phpMyAdmin and hand-written DDL contain, and lets every error
// name its line and what was expected there. Everything else in a dump is passed over.
//
// The model has no place for some of what MySQL writes on a column. What makes a type what it is
// stays in the type (`INT(11) UNSIGNED AUTO_INCREMENT`); character sets and collations are dropped.

/** MySQL has no schemas inside a database: the model's default one stands for the database in use. */
const DEFAULT_SCHEMA = 'public';
const DEFAULT_INDEX_METHOD = 'btree';

type Kind = 'create table' | 'create index' | 'alter table' | 'drop table';

const ON_DELETE: Record<string, OnDelete> = {
  CASCADE: 'CASCADE',
  RESTRICT: 'RESTRICT',
  'SET NULL': 'SET NULL',
  'NO ACTION': 'NO ACTION',
};
const REFERENCE_ACTIONS = [['SET', 'NULL'], ['SET', 'DEFAULT'], ['NO', 'ACTION'], ['CASCADE'], ['RESTRICT']];

/** The words a key or constraint starts with, where a column definition starts with a name. All are reserved. */
const CONSTRAINT_START = new Set(['CONSTRAINT', 'PRIMARY', 'UNIQUE', 'FOREIGN', 'CHECK', 'INDEX', 'KEY', 'FULLTEXT', 'SPATIAL']);

/** Whether a token is one of the words a key or constraint starts with. */
function startsConstraint(token: Token | undefined): boolean {
  return token?.kind === 'word' && CONSTRAINT_START.has(token.upper);
}

/** The words that may follow the first word of a type and belong to it: `DOUBLE PRECISION`. */
const TYPE_NEXT_WORD: Record<string, string[]> = {
  DOUBLE: ['PRECISION'],
  CHARACTER: ['VARYING'],
  CHAR: ['VARYING'],
  NATIONAL: ['CHAR', 'CHARACTER', 'VARCHAR'],
  LONG: ['VARCHAR', 'VARBINARY'],
};

/** What is written after a type and makes it another one, in the order the model writes it. */
const TYPE_ATTRIBUTES = ['UNSIGNED', 'ZEROFILL', 'AUTO_INCREMENT'];
/** The words of a column definition that say nothing the model keeps. */
const COLUMN_NOISE = ['SIGNED', 'BINARY', 'ASCII', 'UNICODE', 'VISIBLE', 'INVISIBLE'];
/** The words of a column definition that are followed by one value, which is not kept either. */
const COLUMN_SETTINGS = ['COLLATE', 'CHARSET', 'COLUMN_FORMAT', 'STORAGE', 'SRID', 'ENGINE_ATTRIBUTE', 'SECONDARY_ENGINE_ATTRIBUTE'];
/** The same for an index. */
const INDEX_NOISE = ['VISIBLE', 'INVISIBLE', 'IGNORED'];
const INDEX_SETTINGS = ['KEY_BLOCK_SIZE', 'COMMENT', 'ENGINE_ATTRIBUTE', 'SECONDARY_ENGINE_ATTRIBUTE', 'ALGORITHM', 'LOCK'];

const STRING_ESCAPES: Record<string, string> = { n: '\n', r: '\r', t: '\t', 0: '\0' };

/** What is known of the script so far. */
interface Context {
  sql: string;
  lineOf: (offset: number) => number;
  tables: Map<string, DraftTable>;
  warnings: string[];
  /** CHECK constraints seen; the model has no place for them. */
  checks: number;
  /** ON UPDATE clauses seen on columns; the model has no place for them either. */
  onUpdates: number;
}

/** The columns of a key or an index. */
interface KeyParts {
  columns: string[];
  /** A part covers only the first characters of its column: `title(100)`. */
  prefix: boolean;
  /** A part is an expression instead of a column. */
  expression: boolean;
}

interface Reference {
  table: string;
  columns: string[];
  onDelete?: string;
}

/** A column as its definition gives it, and the keys the definition puts it in. */
interface ColumnDefinition {
  column: DraftColumn;
  primary: boolean;
  unique: boolean;
  reference?: Reference;
  /** Where the definition starts. */
  offset: number;
}

/** A place in a statement, whose tokens are read from left to right. */
class Reader {
  readonly ctx: Context;
  readonly tokens: Token[];
  /** The index of the token that is read next. */
  at = 0;

  constructor(ctx: Context, tokens: Token[]) {
    this.ctx = ctx;
    this.tokens = tokens;
  }

  /** The token that is read next, or one near it; undefined past either end of the statement. */
  peek(ahead = 0): Token | undefined {
    return this.tokens[this.at + ahead];
  }

  /** Where the next token is; at the end of the statement, where its last one is. */
  get offset(): number {
    return (this.peek() ?? this.tokens[this.tokens.length - 1]).start;
  }

  /** Reads these words when they are what comes next, and says whether they were. */
  words(...words: string[]): boolean {
    if (!words.every((word, n) => isWord(this.peek(n), word))) return false;
    this.at += words.length;
    return true;
  }

  /** Reads one of these words when it comes next. */
  oneOf(words: readonly string[]): boolean {
    return words.some((word) => this.words(word));
  }

  symbol(text: string): boolean {
    if (!isSymbol(this.peek(), text)) return false;
    this.at++;
    return true;
  }

  expectWord(word: string) {
    if (!this.words(word)) unexpected(this, `\`${word}\``);
  }

  expectSymbol(text: string) {
    if (!this.symbol(text)) unexpected(this, `\`${text}\``);
  }

  /** Reads a name. With ANSI_QUOTES a name may be in double quotes, which otherwise hold a string. */
  name(): string {
    const token = this.peek();
    if (!token || !(isName(token) || (token.kind === 'string' && token.text[0] === '"'))) unexpected(this, t('parse.token.name'));
    this.at++;
    return nameOf(token);
  }

  /** Moves to just after the first `word` of the statement. */
  skipPast(word: string) {
    this.at = this.tokens.findIndex((t) => isWord(t, word)) + 1;
  }
}

function fail(ctx: Context, message: string, offset: number): never {
  throw new Failure({ message, line: ctx.lineOf(offset) });
}

/** A name as it is written: MySQL keeps its case. The quotes around it are taken off. */
function nameOf(token: Token): string {
  if (token.kind === 'word') return token.text;
  const quote = token.text[0];
  return token.text.slice(1, -1).split(quote + quote).join(quote);
}

/** A token as a message shows it. What a message puts in backticks is set as code, so it can hold none itself. */
function shown(token: Token): string {
  return (token.kind === 'quoted' ? nameOf(token) : token.text).replace(/`/g, '');
}

function near(ctx: Context, offset: number): { message: string; line: number } {
  const line = ctx.lineOf(offset);
  return { message: t('parse.near', { line }), line };
}

/** Stops at the token that cannot be read, saying what was expected in its place when that is known. */
function unexpected(r: Reader, expected?: string): never {
  const { ctx, tokens } = r;
  const token = r.peek();
  if (!token) {
    throw new Failure({
      ...near(ctx, tokens[tokens.length - 1].start),
      detail: `${t('parse.incomplete')} ${t('parse.rest')}`,
    });
  }
  const before = r.peek(-1);
  const detail = [
    t('parse.unexpected', { token: shown(token) }),
    isSymbol(token, ')') && isSymbol(before, ',') ? t('parse.removeComma') : expected ? t('parse.expected', { expected }) : '',
    t('parse.rest'),
  ];
  // A `)` that opens its line is unexpected because of what the line above ends with.
  const opensLine = !!before && ctx.lineOf(before.start) < ctx.lineOf(token.start);
  throw new Failure({
    ...near(ctx, opensLine && token.kind === 'symbol' ? before.start : token.start),
    detail: detail.filter(Boolean).join(' '),
  });
}

/** What a statement is, by its first words; null for the ones that do not define tables. */
function kindOf(tokens: Token[]): Kind | null {
  const word = (i: number) => (tokens[i]?.kind === 'word' ? tokens[i].upper : '');
  let i = 1;
  if (word(0) === 'CREATE') {
    // MariaDB replaces what is there with CREATE OR REPLACE.
    if (word(i) === 'OR' && word(i + 1) === 'REPLACE') i += 2;
    if (word(i) === 'TEMPORARY') i++;
    if (word(i) === 'TABLE') return 'create table';
    if (['UNIQUE', 'FULLTEXT', 'SPATIAL'].includes(word(i))) i++;
    if (word(i) === 'INDEX') return 'create index';
  }
  if (word(0) === 'ALTER') {
    while (['ONLINE', 'IGNORE'].includes(word(i))) i++;
    if (word(i) === 'TABLE') return 'alter table';
  }
  if (word(0) === 'DROP' && word(word(i) === 'TEMPORARY' ? i + 1 : i) === 'TABLE') return 'drop table';
  return null;
}

/** Reads from the `(` that comes next to the `)` that closes it, and gives the tokens between the two. */
function parenthesized(r: Reader): Token[] {
  if (!isSymbol(r.peek(), '(')) unexpected(r, '`(`');
  const close = closing(r.tokens, r.at);
  if (close < 0) {
    r.at = r.tokens.length;
    unexpected(r);
  }
  const inside = r.tokens.slice(r.at + 1, close);
  r.at = close + 1;
  return inside;
}

/** Reads a table name, which may be written as database.table. */
function tableName(r: Reader): { name: string; schema?: string } {
  const first = r.name();
  return r.symbol('.') ? { name: r.name(), schema: first } : { name: first };
}

/** Reads a string and gives its text, without the quotes and the escapes. */
function stringText(r: Reader): string {
  const token = r.peek();
  if (token?.kind !== 'string') unexpected(r, t('parse.token.string'));
  r.at++;
  const quote = token.text[0];
  return token.text
    .slice(1, -1)
    .replace(/\\([\s\S])|''|""/g, (match, escaped?: string) =>
      escaped !== undefined ? (STRING_ESCAPES[escaped] ?? escaped) : match[0] === quote ? quote : match,
    );
}

/** Reads the one value a setting has, after its optional `=`. */
function settingValue(r: Reader) {
  r.symbol('=');
  const token = r.peek();
  if (!token || token.kind === 'symbol') unexpected(r, t('parse.token.value'));
  r.at++;
}

/** Reads a type and gives it as the model writes it: upper case, the arguments without spaces. */
function dataType(r: Reader): string {
  const first = r.peek();
  if (first?.kind !== 'word') unexpected(r, t('parse.token.dataType'));
  r.at++;
  let name = first.upper;
  for (let last = name; TYPE_NEXT_WORD[last]?.includes(r.peek()?.upper ?? ''); r.at++) {
    last = r.peek()!.upper;
    name += ` ${last}`;
  }
  if (!isSymbol(r.peek(), '(')) return name;
  return `${name}(${parenthesized(r)
    .map((t) => t.text)
    .join('')})`;
}

/**
 * Reads the value after DEFAULT or ON UPDATE and gives it as the script has it: a literal, with
 * its sign or prefix (`-1`, `b'0'`), a function with its arguments (`CURRENT_TIMESTAMP(6)`), or
 * an expression in parentheses.
 */
function valueText(r: Reader): string {
  const first = r.peek();
  if (isSymbol(first, '(')) parenthesized(r);
  else {
    if (isSymbol(first, '-') || isSymbol(first, '+')) r.at++;
    const token = r.peek();
    if (!token || token.kind === 'symbol' || token.kind === 'quoted') unexpected(r, t('parse.token.value'));
    r.at++;
    const next = r.peek();
    if (token.kind === 'word' && next?.kind === 'string' && next.start === token.end) r.at++;
    else if (token.kind === 'word' && isSymbol(next, '(')) parenthesized(r);
  }
  return r.ctx.sql.slice(first!.start, r.peek(-1)!.end);
}

/** Reads `CHECK (…)`, from after the word. The model has no place for it. */
function check(r: Reader) {
  parenthesized(r);
  if (!r.words('NOT', 'ENFORCED')) r.words('ENFORCED');
  r.ctx.checks++;
}

/** Reads the columns of a key: `(a, b(10) DESC)`. */
function keyParts(r: Reader): KeyParts {
  const parts: KeyParts = { columns: [], prefix: false, expression: false };
  r.expectSymbol('(');
  do {
    if (isSymbol(r.peek(), '(')) {
      parenthesized(r);
      parts.expression = true;
    } else {
      parts.columns.push(r.name());
      if (isSymbol(r.peek(), '(')) {
        parenthesized(r);
        parts.prefix = true;
      }
    }
    if (!r.words('ASC')) r.words('DESC');
  } while (r.symbol(','));
  r.expectSymbol(')');
  return parts;
}

/** Reads `REFERENCES table (column)` with what may follow it: MATCH, and the ON DELETE and ON UPDATE actions. */
function reference(r: Reader): Reference {
  r.expectWord('REFERENCES');
  const { name: table } = tableName(r);
  const columns = isSymbol(r.peek(), '(') ? keyParts(r).columns : [PRIMARY_KEY];
  const action = () => {
    const words = REFERENCE_ACTIONS.find((a) => r.words(...a));
    if (!words) unexpected(r, anyOf(['`CASCADE`', '`RESTRICT`', '`SET NULL`', '`NO ACTION`']));
    return words.join(' ');
  };
  let onDelete: string | undefined;
  for (;;) {
    if (r.words('MATCH')) r.name();
    else if (r.words('ON', 'DELETE')) onDelete = action();
    else if (r.words('ON', 'UPDATE')) action();
    else break;
  }
  return { table, columns, onDelete };
}

/** Reads `USING BTREE` when it comes next, and gives the method in lower case. */
function indexMethod(r: Reader): string | undefined {
  return r.words('USING') ? r.name().toLowerCase() : undefined;
}

/** Reads what may follow the columns of an index, and gives the method when it is among it. */
function indexOptions(r: Reader): string | undefined {
  let using: string | undefined;
  for (;;) {
    const method = indexMethod(r);
    if (method) using = method;
    else if (r.words('WITH', 'PARSER')) r.name();
    else if (r.oneOf(INDEX_SETTINGS)) settingValue(r);
    else if (!r.oneOf(INDEX_NOISE) && !r.words('NOT', 'IGNORED')) return using;
  }
}

/** The column of a table by its name, which MySQL compares without regard to case. */
function findColumn(table: DraftTable, name: string): DraftColumn | undefined {
  const lower = name.toLowerCase();
  return table.columns.find((c) => c.name.toLowerCase() === lower);
}

function columnOf(ctx: Context, table: DraftTable, name: string, offset: number): DraftColumn {
  const column = findColumn(table, name);
  if (!column) fail(ctx, t('validate.columnMissing', { name, table: table.name }), offset);
  return column;
}

function addIndex(
  ctx: Context,
  table: DraftTable,
  index: { type: IndexType; parts: KeyParts; name?: string; using?: string },
  offset: number,
) {
  const named = { index: index.name ?? t('parse.warn.unnamedIndex'), table: table.name };
  // An index of the model lists columns.
  if (index.parts.expression) {
    ctx.warnings.push(t('parse.warn.indexExpression', named));
    return;
  }
  const columns = index.parts.columns.map((name) => columnOf(ctx, table, name, offset));
  if (index.parts.prefix) ctx.warnings.push(t('parse.warn.indexPrefix', named));

  // Index names are the table's own, and MySQL compares them without regard to case.
  const taken = (name: string) => table.indexes.some((i) => i.name.toLowerCase() === name.toLowerCase());
  let name = index.name;
  if (name === undefined) {
    // An unnamed index gets the name MySQL would give it: that of its first column, numbered when it is taken.
    name = columns[0].name;
    for (let n = 2; taken(name); n++) name = `${columns[0].name}_${n}`;
  } else if (taken(name)) {
    fail(ctx, t('validate.indexExistsIn', { name, table: table.name }), offset);
  }
  table.indexes.push({ name, type: index.type, using: index.using ?? DEFAULT_INDEX_METHOD, columns: columns.map((c) => c.name) });
  // An index on the start of a column does not make the whole column unique.
  if (index.type === 'UNIQUE' && columns.length === 1 && !index.parts.prefix) columns[0].unique = true;
}

function setPrimaryKey(ctx: Context, table: DraftTable, names: string[], offset: number) {
  if (table.indexes.some((i) => i.type === 'PRIMARY KEY')) fail(ctx, t('validate.primaryKeyExists', { name: table.name }), offset);
  const columns = names.map((name) => columnOf(ctx, table, name, offset));
  for (const column of columns) {
    column.pk = true;
    column.nullable = false;
  }
  // MySQL calls every primary key PRIMARY. It gets the name the model gives a key that has none, which tells the tables' keys apart.
  table.indexes.push({ name: `${table.name}_pkey`, type: 'PRIMARY KEY', using: DEFAULT_INDEX_METHOD, columns: columns.map((c) => c.name) });
}

function setForeignKey(ctx: Context, table: DraftTable, columns: string[], target: Reference, offset: number) {
  if (columns.length !== 1 || target.columns.length !== 1) {
    // A column of the model references one column.
    ctx.warnings.push(t('parse.warn.compositeForeignKey', { table: table.name, columns: columns.map((c) => `\`${c}\``).join(', ') }));
    return;
  }
  const column = columnOf(ctx, table, columns[0], offset);
  const path = `${table.name}.${column.name}`;
  if (column.fk) ctx.warnings.push(t('parse.warn.severalForeignKeys', { column: path }));
  if (target.onDelete === 'SET DEFAULT') ctx.warnings.push(t('parse.warn.setDefault', { column: path }));
  // Without the clause MySQL takes no action.
  column.fk = { table: target.table, column: target.columns[0], onDelete: ON_DELETE[target.onDelete ?? ''] ?? 'NO ACTION' };
}

/**
 * Whether a key of the table starts on a new line here, where a column definition is still being
 * read: the comma before it was left out. Unlike the keys a definition gives its own column, it
 * lists columns.
 */
function startsTableKey(r: Reader): boolean {
  const { ctx } = r;
  const before = r.peek(-1);
  const token = r.peek();
  if (!before || !token || ctx.lineOf(before.start) === ctx.lineOf(token.start)) return false;
  let i = 0;
  // The name of a constraint may be left out.
  if (isWord(token, 'CONSTRAINT')) i = startsConstraint(r.peek(1)) ? 1 : 2;
  if (isWord(r.peek(i), 'FOREIGN')) return true;
  const primary = isWord(r.peek(i), 'PRIMARY');
  const words = i;
  if (primary || isWord(r.peek(i), 'UNIQUE')) i++;
  if (isWord(r.peek(i), 'KEY') || isWord(r.peek(i), 'INDEX')) i++;
  if (i === words) return false;
  const lists = (t: Token | undefined) => isSymbol(t, '(') || isWord(t, 'USING');
  const named = !primary && isName(r.peek(i)) && !isWord(r.peek(i), 'CHECK') && !isWord(r.peek(i), 'REFERENCES');
  return lists(r.peek(i)) || (named && lists(r.peek(i + 1)));
}

/** Reads a column definition: its name, its type and whatever is said about it after that. */
function columnDefinition(r: Reader, table: DraftTable): ColumnDefinition {
  const { ctx } = r;
  const offset = r.offset;
  const name = r.name();
  const type = dataType(r);
  const column: DraftColumn = { name, type, nullable: true, pk: false, unique: false };
  const definition: ColumnDefinition = { column, primary: false, unique: false, offset };
  const attributes = new Set<string>();

  while (!startsTableKey(r)) {
    if (r.words('NOT')) {
      r.expectWord('NULL');
      column.nullable = false;
    } else if (r.words('NULL')) column.nullable = true;
    else if (r.words('DEFAULT')) {
      const text = valueText(r);
      // mysqldump writes DEFAULT NULL on every column that may be NULL, which says what the column has without it.
      if (text.toUpperCase() === 'NULL') delete column.default;
      else column.default = text;
    } else if (r.oneOf(TYPE_ATTRIBUTES)) attributes.add(r.peek(-1)!.upper);
    else if (r.words('PRIMARY')) {
      r.expectWord('KEY');
      definition.primary = true;
    } else if (r.words('KEY')) definition.primary = true;
    else if (r.words('UNIQUE')) {
      r.words('KEY');
      definition.unique = true;
    } else if (r.words('COMMENT')) column.comment = stringText(r);
    else if (r.words('ON', 'UPDATE')) {
      valueText(r);
      ctx.onUpdates++;
    } else if (r.words('GENERATED', 'ALWAYS', 'AS') || r.words('AS')) {
      parenthesized(r);
      r.oneOf(['VIRTUAL', 'STORED', 'PERSISTENT']);
      ctx.warnings.push(t('parse.warn.generatedColumn', { column: `${table.name}.${name}` }));
    } else if (isWord(r.peek(), 'REFERENCES')) definition.reference = reference(r);
    else if (r.words('CONSTRAINT')) {
      // The name of the constraint that follows; it may be left out.
      if (!startsConstraint(r.peek())) r.name();
    } else if (r.words('CHECK')) check(r);
    else if (r.words('CHARACTER', 'SET') || r.oneOf(COLUMN_SETTINGS)) settingValue(r);
    else if (!r.oneOf(COLUMN_NOISE)) break;
  }

  column.type = [type, ...TYPE_ATTRIBUTES.filter((a) => attributes.has(a))].join(' ');
  // An AUTO_INCREMENT column is NOT NULL without saying so, and SERIAL stands for one.
  if (attributes.has('AUTO_INCREMENT') || type === 'SERIAL') column.nullable = false;
  return definition;
}

/** Puts a column in the keys its own definition names. */
function inlineKeys(ctx: Context, table: DraftTable, name: string, definition: ColumnDefinition) {
  const { offset } = definition;
  if (definition.primary) setPrimaryKey(ctx, table, [name], offset);
  if (definition.unique) addIndex(ctx, table, { type: 'UNIQUE', parts: { columns: [name], prefix: false, expression: false } }, offset);
  if (definition.reference) setForeignKey(ctx, table, [name], definition.reference, offset);
}

function addColumn(ctx: Context, table: DraftTable, definition: ColumnDefinition) {
  const { column, offset } = definition;
  if (findColumn(table, column.name)) fail(ctx, t('validate.columnExists', { name: column.name, table: table.name }), offset);
  table.columns.push(column);
  inlineKeys(ctx, table, column.name, definition);
}

/** `MODIFY` writes the definition of a column anew. The keys the column is in stay as they are. */
function modifyColumn(ctx: Context, table: DraftTable, definition: ColumnDefinition) {
  const old = columnOf(ctx, table, definition.column.name, definition.offset);
  table.columns[table.columns.indexOf(old)] = {
    ...definition.column,
    name: old.name,
    nullable: definition.column.nullable && !old.pk,
    pk: old.pk,
    unique: old.unique,
    ...(old.fk ? { fk: old.fk } : {}),
  };
  inlineKeys(ctx, table, old.name, definition);
}

/**
 * Reads a key or a constraint of a table. It is put on the table by the function this returns, so
 * that a CREATE TABLE can read its columns first: a key may be written above the columns it names.
 */
function constraint(r: Reader, table: DraftTable): () => void {
  const { ctx } = r;
  const offset = r.offset;
  let name: string | undefined;
  if (r.words('CONSTRAINT')) {
    // The name of a constraint may be left out.
    if (!startsConstraint(r.peek())) name = r.name();
  }

  if (r.words('PRIMARY')) {
    r.expectWord('KEY');
    indexMethod(r);
    const { columns } = keyParts(r);
    indexOptions(r);
    return () => setPrimaryKey(ctx, table, columns, offset);
  }
  if (r.words('FOREIGN')) {
    r.expectWord('KEY');
    // The name of the index that goes with the key.
    if (!isSymbol(r.peek(), '(')) r.name();
    const { columns } = keyParts(r);
    const target = reference(r);
    return () => setForeignKey(ctx, table, columns, target, offset);
  }
  if (r.words('CHECK')) {
    check(r);
    return () => {};
  }

  const unique = r.words('UNIQUE');
  const kind = r.words('FULLTEXT') ? 'fulltext' : r.words('SPATIAL') ? 'spatial' : undefined;
  // After UNIQUE, FULLTEXT and SPATIAL the word INDEX or KEY may be left out.
  if (!r.oneOf(['INDEX', 'KEY']) && !unique && !kind) unexpected(r, anyOf(['`PRIMARY`', '`UNIQUE`', '`FOREIGN`', '`CHECK`']));
  if (!isSymbol(r.peek(), '(') && !isWord(r.peek(), 'USING')) name = r.name();
  const before = indexMethod(r);
  const parts = keyParts(r);
  const using = indexOptions(r) ?? before ?? kind;
  return () => addIndex(ctx, table, { type: unique ? 'UNIQUE' : 'INDEX', parts, name, using }, offset);
}

/** Reads what ends a definition in a column list: the `,` before the next one, or the `)` after the last. Says whether it was the last. */
function endOfDefinition(r: Reader, definition: string): boolean {
  const { ctx } = r;
  if (r.symbol(',')) return false;
  if (r.symbol(')')) return true;
  const token = r.peek();
  const before = r.peek(-1);
  // A definition that starts on a new line while the one above it has not ended: a comma is missing.
  if (token && before && isName(token) && ctx.lineOf(before.start) < ctx.lineOf(token.start)) {
    throw new Failure({ ...near(ctx, before.start), detail: `${t('parse.expectedAfter', { definition })} ${t('parse.rest')}` });
  }
  unexpected(r, anyOf(['`,`', '`)`']));
}

/** Reads what follows the column list. It says how the table is stored, and only the comment is kept. */
function tableOptions(r: Reader, table: DraftTable) {
  while (r.peek()) {
    if (r.words('COMMENT')) {
      r.symbol('=');
      table.comment = stringText(r);
    } else if (r.words('PARTITION', 'BY')) {
      r.ctx.warnings.push(t('parse.warn.unsupportedClause', { table: table.name, clause: 'PARTITION BY' }));
      r.at = r.tokens.length;
    } else r.at++;
  }
}

function createTable(r: Reader, statement: Statement) {
  const { ctx } = r;
  r.skipPast('TABLE');
  const ifNotExists = r.words('IF', 'NOT', 'EXISTS');
  const offset = r.offset;
  const { name, schema } = tableName(r);
  // A table made from another one has no columns of its own: LIKE, or the result of a SELECT.
  const inside = isSymbol(r.peek(), '(') ? r.peek(1) : r.peek();
  if (['LIKE', 'AS', 'SELECT'].some((word) => isWord(inside, word))) {
    ctx.warnings.push(t('parse.warn.noColumnList', { line: ctx.lineOf(statement.start) }));
    return;
  }
  r.expectSymbol('(');
  if (ctx.tables.has(name)) {
    if (ifNotExists) return;
    fail(ctx, t('validate.tableExists', { name }), offset);
  }

  const table: DraftTable = { name, schema: schema ?? DEFAULT_SCHEMA, comment: '', columns: [], indexes: [] };
  const constraints: (() => void)[] = [];
  for (let last = false; !last; ) {
    if (startsConstraint(r.peek())) {
      constraints.push(constraint(r, table));
      last = endOfDefinition(r, t('parse.thisConstraint'));
    } else {
      const definition = columnDefinition(r, table);
      addColumn(ctx, table, definition);
      last = endOfDefinition(r, t('parse.columnDefinition', { name: definition.column.name }));
    }
  }
  for (const apply of constraints) apply();
  tableOptions(r, table);
  ctx.tables.set(name, table);
}

/** The table a later statement is about. A statement about a table the script does not define is skipped. */
function knownTable(r: Reader, statement: Statement, what: string, name: string): DraftTable | undefined {
  const { ctx } = r;
  const table = ctx.tables.get(name);
  if (!table) {
    ctx.warnings.push(t('parse.warn.unknownTable', { line: ctx.lineOf(statement.start), statement: what, table: name }));
  }
  return table;
}

/** Moves to the `,` that ends a clause of ALTER TABLE, or to the end of the statement. Says whether the clause sets something with `=`. */
function skipClause(r: Reader): boolean {
  let depth = 0;
  let sets = false;
  for (let token = r.peek(); token; token = r.peek()) {
    if (isSymbol(token, '(')) depth++;
    else if (isSymbol(token, ')')) depth--;
    else if (depth === 0 && isSymbol(token, ',')) break;
    else if (depth === 0 && isSymbol(token, '=')) sets = true;
    r.at++;
  }
  return sets;
}

function alterTable(r: Reader, statement: Statement) {
  const { ctx } = r;
  r.skipPast('TABLE');
  const table = knownTable(r, statement, 'ALTER TABLE', tableName(r).name);
  if (!table) return;
  while (r.peek()) {
    const clause = r.peek()!;
    if (r.words('ADD')) {
      if (startsConstraint(r.peek())) constraint(r, table)();
      else {
        r.words('COLUMN');
        addColumn(ctx, table, columnDefinition(r, table));
      }
    } else if (r.words('MODIFY')) {
      r.words('COLUMN');
      modifyColumn(ctx, table, columnDefinition(r, table));
    } else if (r.words('COMMENT')) {
      r.symbol('=');
      table.comment = stringText(r);
    } else if (!skipClause(r)) {
      // What sets how the table is stored (`AUTO_INCREMENT=42`) is passed over; anything else changes it in a way that is not read.
      ctx.warnings.push(
        t('parse.warn.notImported', { line: ctx.lineOf(clause.start), statement: `ALTER TABLE ${table.name} ${shown(clause).toUpperCase()}` }),
      );
    }
    // Where a column goes among the others.
    if (!r.words('FIRST') && r.words('AFTER')) r.name();
    if (!r.peek()) break;
    r.expectSymbol(',');
    if (!r.peek()) unexpected(r);
  }
}

function createIndex(r: Reader, statement: Statement) {
  const { ctx } = r;
  r.skipPast('INDEX');
  const before = r.tokens.slice(0, r.at - 1);
  const unique = before.some((t) => isWord(t, 'UNIQUE'));
  const kind = before.some((t) => isWord(t, 'FULLTEXT')) ? 'fulltext' : before.some((t) => isWord(t, 'SPATIAL')) ? 'spatial' : undefined;
  const offset = r.offset;
  const name = r.name();
  const method = indexMethod(r);
  r.expectWord('ON');
  const { name: tableNamed } = tableName(r);
  const parts = keyParts(r);
  const using = indexOptions(r) ?? method ?? kind;
  if (r.peek()) unexpected(r);
  const table = knownTable(r, statement, 'CREATE INDEX', tableNamed);
  if (table) addIndex(ctx, table, { type: unique ? 'UNIQUE' : 'INDEX', parts, name, using }, offset);
}

function dropTable(r: Reader) {
  r.skipPast('TABLE');
  r.words('IF', 'EXISTS');
  while (isName(r.peek())) {
    r.ctx.tables.delete(tableName(r).name);
    if (!r.symbol(',')) break;
  }
}

/** Reads one statement into the context. Returns false for a statement that does not define tables. */
function read(ctx: Context, statement: Statement): boolean {
  const kind = kindOf(statement.tokens);
  if (!kind) return false;
  const r = new Reader(ctx, statement.tokens);
  if (kind === 'create table') createTable(r, statement);
  else if (kind === 'alter table') alterTable(r, statement);
  else if (kind === 'create index') createIndex(r, statement);
  else dropTable(r);
  return true;
}

/** Writes each referenced column as its table defines it: MySQL finds it whatever the case of its letters. */
function matchReferencedColumns(ctx: Context) {
  for (const table of ctx.tables.values()) {
    for (const { fk } of table.columns) {
      const column = fk && ctx.tables.get(fk.table)?.columns.find((c) => c.name.toLowerCase() === fk.column.toLowerCase());
      if (fk && column) fk.column = column.name;
    }
  }
}

function parse(sql: string): ParseOutcome {
  const lineOf = lineCounter(sql);
  const ctx: Context = { sql, lineOf, tables: new Map(), warnings: [], checks: 0, onUpdates: 0 };
  const script = splitStatements(sql, 'mysql');
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

  matchReferencedColumns(ctx);
  resolveForeignKeys(ctx.tables, ctx.warnings);
  if (ctx.checks) ctx.warnings.push(t('parse.warn.checks', { count: ctx.checks }));
  if (ctx.onUpdates) ctx.warnings.push(t('parse.warn.onUpdates', { count: ctx.onUpdates }));
  return { ok: true, tables: finishTables(ctx.tables, ctx.warnings), warnings: ctx.warnings, skipped };
}

export const mysqlParser: SqlParser = { engine: 'MySQL', parse };
