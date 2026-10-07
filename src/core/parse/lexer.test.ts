import { describe, expect, it } from 'vitest';
import { ecommerceDump, ecommerceMysqlDump, ecommerceSql } from '../fixtures/sql';
import { lineCounter, splitStatements, type Statement } from './lexer';

const texts = (statement: Statement) => statement.tokens.map((t) => t.text);
/** The first words of each statement, as a parser looks at them. */
const heads = (sql: string, words = 2) =>
  splitStatements(sql).statements.map((s) =>
    s.tokens
      .slice(0, words)
      .map((t) => t.upper)
      .join(' '),
  );

describe('splitStatements', () => {
  it('splits a script at its semicolons', () => {
    const { statements, error } = splitStatements('CREATE TABLE a (id INT);\n\nCREATE TABLE b (id INT)');
    expect(error).toBeUndefined();
    expect(statements.map(texts)).toEqual([
      ['CREATE', 'TABLE', 'a', '(', 'id', 'INT', ')'],
      ['CREATE', 'TABLE', 'b', '(', 'id', 'INT', ')'],
    ]);
  });

  it('says where each statement and token is', () => {
    const sql = '  SELECT 1;\n-- next\nSELECT 22 ;';
    const [first, second] = splitStatements(sql).statements;
    expect(sql.slice(first.start, first.end)).toBe('SELECT 1');
    expect(sql.slice(second.start, second.end)).toBe('SELECT 22');
    expect(second.tokens[1]).toEqual({ kind: 'number', text: '22', upper: '22', start: 27, end: 29 });
  });

  it('upper-cases words only', () => {
    const [{ tokens }] = splitStatements(`select "select", 'select'`).statements;
    expect(tokens.map((t) => [t.kind, t.upper])).toEqual([
      ['word', 'SELECT'],
      ['quoted', '"select"'],
      ['symbol', ','],
      ['string', "'select'"],
    ]);
  });

  it('leaves out comments and empty statements', () => {
    const sql = '-- one\n/* two; /* nested; */ still; */ SELECT 1; ;; -- three;\nSELECT 2';
    expect(splitStatements(sql).statements.map(texts)).toEqual([
      ['SELECT', '1'],
      ['SELECT', '2'],
    ]);
  });

  it('keeps a semicolon inside a string, a quoted name or a dollar-quoted body', () => {
    const sql = `SELECT 'a;''b', "c;""d", E'e\\';f', $$ g; $$, $fn$ h; $$ i; $fn$; SELECT 2`;
    const { statements } = splitStatements(sql);
    expect(statements.map(texts)).toEqual([
      ['SELECT', "'a;''b'", ',', '"c;""d"', ',', "E'e\\';f'", ',', '$$ g; $$', ',', '$fn$ h; $$ i; $fn$'],
      ['SELECT', '2'],
    ]);
  });

  it('takes a lone dollar sign for a symbol', () => {
    expect(splitStatements('SELECT $1').statements.map(texts)).toEqual([['SELECT', '$', '1']]);
  });

  it('passes over psql commands and the rows of COPY … FROM stdin', () => {
    const sql = [
      '\\connect shop',
      'COPY public.users (id, email) FROM stdin;',
      "1\tann@example.com; it's",
      '2\tbob@example.com',
      '\\.',
      'CREATE TABLE t (id INT);',
    ].join('\n');
    expect(heads(sql)).toEqual(['COPY PUBLIC', 'CREATE TABLE']);
  });

  it('stops at a string, quoted name or comment that never ends', () => {
    expect(splitStatements("SELECT 1;\nSELECT 'oops;\nSELECT 3;")).toEqual({
      statements: [expect.objectContaining({ start: 0, end: 8 })],
      error: { message: 'The string that starts here is never closed.', offset: 17 },
    });
    expect(splitStatements('SELECT "oops').error?.message).toBe('The quoted name that starts here is never closed.');
    expect(splitStatements('SELECT 1 /* oops').error?.message).toBe('The comment that starts here is never closed.');
    expect(splitStatements('SELECT $a$ oops $b$').error?.message).toBe('The string that starts here is never closed.');
  });

  it('finds every statement of the ecommerce DDL', () => {
    expect(heads(ecommerceSql)).toEqual([
      'CREATE TABLE',
      'COMMENT ON',
      'CREATE UNIQUE',
      'CREATE INDEX',
      'CREATE TABLE',
      'COMMENT ON',
      'CREATE INDEX',
      'CREATE INDEX',
      'CREATE TABLE',
      'COMMENT ON',
      'CREATE TABLE',
      'CREATE INDEX',
      'CREATE TABLE',
      'ALTER TABLE',
    ]);
  });

  it('keeps the function body of a pg_dump script in one statement', () => {
    const found = heads(ecommerceDump);
    expect(found.filter((h) => h === 'CREATE FUNCTION')).toHaveLength(1);
    expect(found.filter((h) => h === 'CREATE TABLE')).toHaveLength(2);
    expect(found).not.toContain('RETURN NEW');
    expect(found[0]).toBe('SET STATEMENT_TIMEOUT');
  });
});

describe('splitStatements by the rules of MySQL', () => {
  const split = (sql: string) => splitStatements(sql, 'mysql');
  const mysqlHeads = (sql: string) => split(sql).statements.map((s) => `${s.tokens[0].upper} ${s.tokens[1]?.upper ?? ''}`.trim());

  it('takes backticks for a quoted name and double quotes for a string', () => {
    const [{ tokens }] = split('select `a;``b`, "c;\\"d", \'e;\\\'f\'').statements;
    expect(tokens.map((t) => [t.kind, t.text])).toEqual([
      ['word', 'select'],
      ['quoted', '`a;``b`'],
      ['symbol', ','],
      ['string', '"c;\\"d"'],
      ['symbol', ','],
      ['string', "'e;\\'f'"],
    ]);
  });

  it('leaves out # comments, and ends a comment at its first */', () => {
    const sql = '# one;\n/*!40101 SET a = 1; /* not nested */ SELECT 1; SELECT 2 # two;\n; SELECT $$ 3';
    expect(split(sql).statements.map(texts)).toEqual([
      ['SELECT', '1'],
      ['SELECT', '2'],
      ['SELECT', '$', '$', '3'],
    ]);
  });

  it('ends statements at what DELIMITER names', () => {
    const sql = 'SELECT 1;\ndelimiter //\nCREATE TRIGGER t BEGIN SET a = 1; SET b = 2; END //\nSELECT 2 //\nDELIMITER ;\nSELECT 3;';
    expect(split(sql).statements.map((s) => sql.slice(s.start, s.end))).toEqual([
      'SELECT 1',
      'CREATE TRIGGER t BEGIN SET a = 1; SET b = 2; END',
      'SELECT 2',
      'SELECT 3',
    ]);
  });

  it('stops at a name that never ends', () => {
    expect(split('SELECT `oops').error?.message).toBe('The quoted name that starts here is never closed.');
    expect(split('SELECT "oops').error?.message).toBe('The string that starts here is never closed.');
  });

  it('finds the statements of a mysqldump script, with the trigger in one', () => {
    const found = mysqlHeads(ecommerceMysqlDump);
    expect(found.filter((h) => h === 'CREATE TABLE')).toHaveLength(5);
    expect(found.filter((h) => h === 'DROP TABLE')).toHaveLength(5);
    expect(found.filter((h) => h === 'CREATE TRIGGER')).toHaveLength(1);
    expect(found).not.toContain('END');
    expect(found.slice(-4)).toEqual(['LOCK TABLES', 'INSERT INTO', 'UNLOCK TABLES', 'CREATE TRIGGER']);
  });
});

describe('lineCounter', () => {
  it('counts lines from 1', () => {
    const lineOf = lineCounter('ab\ncd\n\nef');
    expect([0, 1, 2, 3, 5, 6, 7, 8].map(lineOf)).toEqual([1, 1, 1, 2, 2, 3, 4, 4]);
  });

  it('has one line for a script without line breaks', () => {
    expect(lineCounter('')(0)).toBe(1);
    expect(lineCounter('SELECT 1')(7)).toBe(1);
  });
});
