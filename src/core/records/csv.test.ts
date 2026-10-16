import { describe, expect, it } from 'vitest';
import { usersImportCsv } from '../fixtures/usersImport';
import { decodeText, looksLikeHeader, parseCsv, sniffDelimiter, uniqueNames } from './csv';

describe('parseCsv', () => {
  it('reads cells, rows and the line each row starts on', () => {
    expect(parseCsv('a,b\n1,2\n3,4\n')).toEqual({ rows: [['a', 'b'], ['1', '2'], ['3', '4']], lines: [1, 2, 3], unclosed: 0 });
  });

  it('reads a quoted cell with the delimiter, quotes and line breaks in it', () => {
    const { rows, lines } = parseCsv('id,note\n1,"a, ""b""\nsecond line"\n2,plain\n');
    expect(rows).toEqual([['id', 'note'], ['1', 'a, "b"\nsecond line'], ['2', 'plain']]);
    // The row after a cell that spans two lines starts on line 4.
    expect(lines).toEqual([1, 2, 4]);
  });

  it('skips blank lines, drops a byte order mark and takes every kind of line end', () => {
    expect(parseCsv('\uFEFFa,b\r\n\r\n1,2\r3,4').rows).toEqual([['a', 'b'], ['1', '2'], ['3', '4']]);
  });

  it('keeps an empty cell and a quote that is not at the start of a cell', () => {
    expect(parseCsv('a,,c\n5" nail,"",x').rows).toEqual([['a', '', 'c'], ['5" nail', '', 'x']]);
  });

  it('reads a row without a line break at the end of the file', () => {
    expect(parseCsv('a;b\n1;2', ';').rows).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('names the line of a quote that never closes', () => {
    expect(parseCsv('a,b\n1,"oops\n2,3\n').unclosed).toBe(2);
    expect(parseCsv('a,b\n1,2\n').unclosed).toBe(0);
  });

  it('reads the 1,000 rows of users_import.csv, with accents and a quoted name', () => {
    const { rows, lines, unclosed } = parseCsv(usersImportCsv);
    expect(unclosed).toBe(0);
    expect(rows).toHaveLength(1001);
    expect(rows.every((r) => r.length === 4)).toBe(true);
    expect(rows[0]).toEqual(['email', 'full_name', 'country_code', 'signup_date']);
    expect(rows[101][1]).toBe('Lê Thị "Hoa", Trần');
    expect(lines[101]).toBe(102);
    expect(rows[790][1]).toHaveLength(300);
  });
});

describe('sniffDelimiter', () => {
  it('picks the delimiter that splits every one of the first lines', () => {
    expect(sniffDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(sniffDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(sniffDelimiter('a\tb\n1\t2')).toBe('\t');
    expect(sniffDelimiter('a|b|c\n1|2|3')).toBe('|');
  });

  it('is a comma for text with no delimiter, and ignores a comma that only some lines have', () => {
    expect(sniffDelimiter('one\ntwo')).toBe(',');
    expect(sniffDelimiter('')).toBe(',');
    expect(sniffDelimiter('a;b\n1;2\nsee x, y;z')).toBe(';');
  });
});

describe('looksLikeHeader', () => {
  it('takes a row of different names, and not a row of values', () => {
    expect(looksLikeHeader(['email', 'full_name', 'signup_date'])).toBe(true);
    expect(looksLikeHeader(['an@example.com', 'An', 'VN'])).toBe(false);
    expect(looksLikeHeader(['1', '2', '3'])).toBe(false);
    expect(looksLikeHeader(['2024-01-01', 'x'])).toBe(false);
    expect(looksLikeHeader(['a', 'a'])).toBe(false);
    expect(looksLikeHeader(['a', ''])).toBe(false);
  });
});

describe('uniqueNames', () => {
  it('names a blank column by its place and numbers a name that repeats', () => {
    expect(uniqueNames(['id', '', 'id', ' name '])).toEqual(['id', 'column_2', 'id_2', 'name']);
  });
});

describe('decodeText', () => {
  const bytes = (...n: number[]) => new Uint8Array(n);

  it('reads UTF-8, with or without a byte order mark', () => {
    expect(decodeText(new TextEncoder().encode('Lê Thị'))).toBe('Lê Thị');
    expect(decodeText(bytes(0xef, 0xbb, 0xbf, 0x61))).toBe('a');
  });

  it('reads UTF-16 that starts with a byte order mark', () => {
    expect(decodeText(bytes(0xff, 0xfe, 0x61, 0x00, 0x62, 0x00))).toBe('ab');
    expect(decodeText(bytes(0xfe, 0xff, 0x00, 0x61, 0x00, 0x62))).toBe('ab');
  });

  it('gives null for bytes that are not UTF-8, such as a code page', () => {
    // "é" in Windows-1252.
    expect(decodeText(bytes(0x63, 0x61, 0x66, 0xe9))).toBeNull();
  });
});
