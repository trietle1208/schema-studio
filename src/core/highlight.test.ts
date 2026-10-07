import { describe, expect, it } from 'vitest';
import { ecommerceSql } from './fixtures/sql';
import { ecommerceSnapshot } from './fixtures/testing';
import { generateJson } from './generate/json';
import { highlightJson, highlightSql, type SyntaxToken } from './highlight';

const text = (tokens: SyntaxToken[]) => tokens.map((t) => t.text).join('');
const kinds = (tokens: SyntaxToken[]) => tokens.filter((t) => t.kind).map((t) => [t.text, t.kind]);

describe('highlightSql', () => {
  it('marks keywords, types, numbers, strings and comments', () => {
    const tokens = highlightSql("-- orders\nCREATE TABLE orders (\n  status VARCHAR(50) NOT NULL DEFAULT 'pending'\n);");
    expect(kinds(tokens)).toEqual([
      ['-- orders', 'comment'],
      ['CREATE', 'keyword'],
      ['TABLE', 'keyword'],
      ['VARCHAR', 'type'],
      ['50', 'number'],
      ['NOT', 'keyword'],
      ['NULL', 'keyword'],
      ['DEFAULT', 'keyword'],
      ["'pending'", 'string'],
    ]);
  });

  it('keeps every character, in order', () => {
    expect(text(highlightSql(ecommerceSql))).toBe(ecommerceSql);
    expect(highlightSql('')).toEqual([]);
    expect(highlightSql('users')).toEqual([{ text: 'users' }]);
  });

  it('ignores case, and words that only contain a keyword', () => {
    expect(kinds(highlightSql('create table settings (key_id bigint, order_no int)'))).toEqual([
      ['create', 'keyword'],
      ['table', 'keyword'],
      ['bigint', 'type'],
      ['int', 'type'],
    ]);
  });

  it('does not look inside strings and comments', () => {
    expect(kinds(highlightSql("'CREATE 1' -- DROP 'x'\n'open"))).toEqual([
      ["'CREATE 1'", 'string'],
      ["-- DROP 'x'", 'comment'],
      ["'open", 'string'],
    ]);
  });
});

describe('highlightJson', () => {
  it('marks values and leaves keys plain', () => {
    expect(kinds(highlightJson('{ "name": "id", "pk": true, "fk": null, "version": 12, "ratio": -1.5e3 }'))).toEqual([
      ['"id"', 'string'],
      ['true', 'keyword'],
      ['null', 'keyword'],
      ['12', 'number'],
      ['-1.5e3', 'number'],
    ]);
  });

  it('does not take words inside a string for values', () => {
    expect(kinds(highlightJson('["true 1", "a\\"b"]'))).toEqual([
      ['"true 1"', 'string'],
      ['"a\\"b"', 'string'],
    ]);
  });

  it('keeps every character of an exported schema', () => {
    const json = generateJson({ name: 'ecommerce', version: 1, engine: 'PostgreSQL' }, ecommerceSnapshot().tables, {
      indexes: true,
      foreignKeys: true,
      comments: true,
    });
    expect(text(highlightJson(json))).toBe(json);
  });
});
