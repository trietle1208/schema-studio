import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot } from './fixtures/testing';
import { ecommerceDump, ecommerceSql, missingCommaSql } from './fixtures/sql';
import {
  availableName,
  byteLength,
  countLines,
  diffFileName,
  excerptAround,
  exportFileName,
  formatBytes,
  migrationFileName,
  schemaNameFromFile,
} from './files';
import { postgresGenerator } from './generate/postgres';
import { postgresParser } from './parse/postgres';
import { validateSchemaName } from './validate';

describe('exportFileName', () => {
  it('names the schema, its version and the format', () => {
    expect(exportFileName('ecommerce', 12, 'sql')).toBe('ecommerce_v12.sql');
    expect(exportFileName('ecommerce', 12, 'json')).toBe('ecommerce_v12.json');
  });

  it('leaves the version out for a schema that is not saved', () => {
    expect(exportFileName('draft', null, 'sql')).toBe('draft.sql');
  });
});

describe('migrationFileName and diffFileName', () => {
  it('name both versions', () => {
    expect(migrationFileName('ecommerce', 11, 12)).toBe('ecommerce_v11_to_v12.sql');
    expect(migrationFileName('ecommerce', 12, 8)).toBe('ecommerce_v12_to_v8.sql');
    expect(diffFileName('ecommerce', 11, 12)).toBe('ecommerce_v11_v12.diff');
  });

  it('says when a migration leads to changes that are not saved', () => {
    expect(migrationFileName('ecommerce', 12, null)).toBe('ecommerce_v12_to_unsaved.sql');
  });
});

describe('byteLength and formatBytes', () => {
  it('counts the bytes of the UTF-8 file, not the characters', () => {
    expect(byteLength('')).toBe(0);
    expect(byteLength('users')).toBe(5);
    expect(byteLength('24 tables · 31')).toBe(15);
  });

  it('shows bytes, then kilobytes and megabytes with one decimal', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(812)).toBe('812 B');
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(14_541)).toBe('14.2 KB');
    expect(formatBytes(3_565_158)).toBe('3.4 MB');
  });

  it('sizes the DDL of the ecommerce sample', () => {
    const sql = postgresGenerator.generate(ecommerceSnapshot().tables);
    expect(byteLength(sql)).toBe(sql.length);
    expect(formatBytes(byteLength(sql))).toMatch(/^\d\.\d KB$/);
  });
});

describe('countLines', () => {
  it('does not count the line break that ends the file', () => {
    expect(countLines('')).toBe(0);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\n')).toBe(1);
    expect(countLines('a\nb')).toBe(2);
    expect(countLines('a\n\nb\n')).toBe(3);
  });

  it('counts the lines of the ecommerce DDL', () => {
    expect(countLines(ecommerceSql)).toBe(ecommerceSql.trimEnd().split('\n').length);
  });
});

describe('schemaNameFromFile', () => {
  it('takes the file name without its extension', () => {
    expect(schemaNameFromFile('ecommerce_prod.sql')).toBe('ecommerce_prod');
    expect(schemaNameFromFile('schema.ddl')).toBe('schema');
    expect(schemaNameFromFile('C:\\dumps\\shop.sql')).toBe('shop');
    expect(schemaNameFromFile('/tmp/dumps/shop.sql')).toBe('shop');
  });

  it('turns what a schema name cannot hold into underscores', () => {
    expect(schemaNameFromFile('Ecommerce Prod (2026-10).dump.sql')).toBe('ecommerce_prod_2026_10_dump');
    expect(schemaNameFromFile('2026-backup.sql')).toBe('schema_2026_backup');
  });

  it('falls back when nothing of the name is left', () => {
    expect(schemaNameFromFile('.sql')).toBe('imported_schema');
    expect(schemaNameFromFile('---.txt')).toBe('imported_schema');
    expect(schemaNameFromFile('')).toBe('imported_schema');
  });

  it('gives names that pass as schema names', () => {
    for (const file of ['ecommerce_prod.sql', 'Ecommerce Prod (2026-10).dump.sql', '2026-backup.sql', '.sql']) {
      expect(validateSchemaName(schemaNameFromFile(file))).toBeNull();
    }
  });
});

describe('availableName', () => {
  it('keeps a name that is free', () => {
    expect(availableName('ecommerce', ['blog'])).toBe('ecommerce');
  });

  it('counts up from 2 until a name is free', () => {
    expect(availableName('ecommerce', ['ecommerce'])).toBe('ecommerce_2');
    expect(availableName('ecommerce', ['ecommerce', 'ecommerce_2', 'ecommerce_3'])).toBe('ecommerce_4');
  });
});

describe('excerptAround', () => {
  const text = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'].join('\n');

  it('takes the line with the lines around it', () => {
    expect(excerptAround(text, 5, 2)).toEqual({ text: 'three\nfour\nfive\nsix\nseven', firstLine: 3 });
    expect(excerptAround(text, 5)).toEqual({ text: 'two\nthree\nfour\nfive\nsix\nseven\neight', firstLine: 2 });
  });

  it('stops at the start and the end of the text', () => {
    expect(excerptAround(text, 1, 2)).toEqual({ text: 'one\ntwo\nthree', firstLine: 1 });
    expect(excerptAround(text, 9, 2)).toEqual({ text: 'seven\neight\nnine', firstLine: 7 });
    expect(excerptAround(text, 40, 1)).toEqual({ text: 'eight\nnine', firstLine: 8 });
  });

  it('shows the line a broken dump fails on', () => {
    const broken = `${ecommerceDump}\n${missingCommaSql}`;
    const outcome = postgresParser.parse(broken);
    const line = outcome.ok ? 0 : outcome.error.line;
    const excerpt = excerptAround(broken, line, 1);
    expect(excerpt.firstLine).toBe(line - 1);
    expect(excerpt.text.split('\n')[1]).toBe('  product_id  BIGINT NOT NULL REFERENCES products(id)');
  });
});
