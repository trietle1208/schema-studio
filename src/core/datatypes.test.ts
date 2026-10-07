import { describe, expect, it } from 'vitest';
import { matchTypes, normalizeType, POSTGRES_TYPES } from './datatypes';

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
