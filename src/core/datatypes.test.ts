import { describe, expect, it } from 'vitest';
import { matchTypes, normalizeType, POSTGRES_TYPES, serialType, widensType } from './datatypes';

const names = (query: string) => matchTypes(query).map((t) => t.name);

describe('POSTGRES_TYPES', () => {
  it('offers every type the ecommerce sample uses except the custom-length ones', () => {
    const offered = new Set(POSTGRES_TYPES.map((t) => t.name));
    for (const type of ['BIGSERIAL', 'BIGINT', 'INTEGER', 'DECIMAL(12,2)', 'VARCHAR(255)', 'VARCHAR(100)', 'VARCHAR(50)', 'TEXT', 'TIMESTAMP', 'TIMESTAMPTZ']) {
      expect(offered.has(type)).toBe(true);
    }
    // payments.provider is VARCHAR(32): typed by hand, not picked from the list.
    expect(offered.has('VARCHAR(32)')).toBe(false);
  });

  it('has no duplicate names', () => {
    expect(new Set(POSTGRES_TYPES.map((t) => t.name)).size).toBe(POSTGRES_TYPES.length);
  });
});

describe('normalizeType', () => {
  it('trims and upper-cases free text', () => {
    expect(normalizeType('  varchar(32) ')).toBe('VARCHAR(32)');
    expect(normalizeType('TIMESTAMPTZ')).toBe('TIMESTAMPTZ');
    expect(normalizeType('   ')).toBe('');
  });
});

describe('matchTypes', () => {
  it('returns every type, in list order, for an empty query', () => {
    expect(matchTypes('')).toEqual(POSTGRES_TYPES);
    expect(matchTypes('  ')).toEqual(POSTGRES_TYPES);
    expect(matchTypes('')).not.toBe(POSTGRES_TYPES);
  });

  it('matches anywhere in the name, ignoring case', () => {
    expect(names('varchar')).toEqual(['VARCHAR(255)', 'VARCHAR(100)', 'VARCHAR(50)']);
    expect(names('int')).toEqual(['BIGINT', 'INTEGER', 'SMALLINT']);
    expect(names('Serial')).toEqual(['BIGSERIAL', 'SERIAL']);
    expect(names('(12')).toEqual(['DECIMAL(12,2)']);
  });

  it('returns nothing for a type that is not in the list', () => {
    expect(names('VARCHAR(32)')).toEqual([]);
    expect(names('order_status')).toEqual([]);
  });

  it('filters a custom list', () => {
    const mysql = [
      { name: 'TINYINT', family: 'integer' },
      { name: 'DATETIME', family: 'date/time' },
    ];
    expect(matchTypes('date', mysql)).toEqual([{ name: 'DATETIME', family: 'date/time' }]);
  });
});

describe('serialType', () => {
  it('is the integer an auto-increment type stores', () => {
    expect(serialType('BIGSERIAL')).toBe('BIGINT');
    expect(serialType('serial')).toBe('INTEGER');
    expect(serialType('SMALLSERIAL')).toBe('SMALLINT');
    expect(serialType('BIGINT')).toBeNull();
  });
});

describe('widensType', () => {
  it('holds for a longer text type', () => {
    expect(widensType('VARCHAR(32)', 'VARCHAR(50)')).toBe(true);
    expect(widensType('VARCHAR(50)', 'TEXT')).toBe(true);
    expect(widensType('VARCHAR(50)', 'VARCHAR')).toBe(true);
    expect(widensType('CHAR(3)', 'VARCHAR(3)')).toBe(true);
    expect(widensType('character varying(10)', 'varchar(10)')).toBe(true);
  });

  it('does not hold for a shorter one', () => {
    expect(widensType('VARCHAR(50)', 'VARCHAR(32)')).toBe(false);
    expect(widensType('TEXT', 'VARCHAR(255)')).toBe(false);
    expect(widensType('VARCHAR', 'VARCHAR(255)')).toBe(false);
    expect(widensType('VARCHAR(3)', 'CHAR(3)')).toBe(false);
  });

  it('holds for a larger integer, auto-increment or not', () => {
    expect(widensType('SMALLINT', 'INTEGER')).toBe(true);
    expect(widensType('INT', 'BIGINT')).toBe(true);
    expect(widensType('SERIAL', 'BIGSERIAL')).toBe(true);
    expect(widensType('INTEGER', 'NUMERIC')).toBe(true);
    expect(widensType('BIGINT', 'INTEGER')).toBe(false);
    expect(widensType('BIGINT', 'DECIMAL(12,2)')).toBe(false);
  });

  it('holds for a decimal with room for every digit on both sides of the point', () => {
    expect(widensType('DECIMAL(10,2)', 'DECIMAL(12,2)')).toBe(true);
    expect(widensType('NUMERIC(10,2)', 'DECIMAL(12,4)')).toBe(true);
    expect(widensType('DECIMAL(10,2)', 'NUMERIC')).toBe(true);
    expect(widensType('DECIMAL(12,2)', 'DECIMAL(10,2)')).toBe(false);
    // Two more digits after the point leave two fewer before it.
    expect(widensType('DECIMAL(10,2)', 'DECIMAL(10,4)')).toBe(false);
    expect(widensType('NUMERIC', 'DECIMAL(12,2)')).toBe(false);
  });

  it('does not vouch for a change between kinds of types', () => {
    expect(widensType('TEXT', 'INTEGER')).toBe(false);
    expect(widensType('TIMESTAMP', 'TIMESTAMPTZ')).toBe(false);
    expect(widensType('INTEGER', 'TEXT')).toBe(false);
    expect(widensType('geometry(Point, 4326)', 'TEXT')).toBe(false);
  });
});
