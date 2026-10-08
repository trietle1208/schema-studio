import { describe, expect, it } from 'vitest';
import { matchTypes, MYSQL_TYPES, normalizeType, POSTGRES_TYPES, referencingType, serialType, typeEngine, typesFor, widensMysqlType, widensType } from './datatypes';

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

describe('typesFor', () => {
  it('offers the types of MySQL in a MySQL schema, and those of PostgreSQL in any other', () => {
    expect(typesFor('MySQL')).toBe(MYSQL_TYPES);
    expect(typesFor('PostgreSQL')).toBe(POSTGRES_TYPES);
    expect(typesFor('SQLite')).toBe(POSTGRES_TYPES);
    expect(['MySQL', 'PostgreSQL', 'SQLite'].map(typeEngine)).toEqual(['MySQL', 'PostgreSQL', 'PostgreSQL']);
  });

  it('lists the types of MySQL once each, with a counting integer instead of SERIAL', () => {
    const names = MYSQL_TYPES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('BIGINT AUTO_INCREMENT');
    expect(names).toContain('DATETIME');
    expect(names).not.toContain('BIGSERIAL');
    expect(matchTypes('auto', MYSQL_TYPES).map((t) => t.name)).toEqual(['BIGINT AUTO_INCREMENT', 'INT AUTO_INCREMENT']);
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

describe('referencingType', () => {
  it('is the type without the counting, which only the referenced column does', () => {
    expect(referencingType('BIGSERIAL')).toBe('BIGINT');
    expect(referencingType('SERIAL')).toBe('INTEGER');
    expect(referencingType('BIGINT UNSIGNED AUTO_INCREMENT')).toBe('BIGINT UNSIGNED');
    expect(referencingType('INT(11) AUTO_INCREMENT')).toBe('INT(11)');
  });

  it('is the type itself for one that does not count', () => {
    expect(referencingType('UUID')).toBe('UUID');
    expect(referencingType('VARCHAR(32)')).toBe('VARCHAR(32)');
    expect(referencingType('BIGINT UNSIGNED')).toBe('BIGINT UNSIGNED');
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

describe('widensMysqlType', () => {
  it('holds for a larger integer of the same sign, whatever width it is shown at', () => {
    expect(widensMysqlType('INT(11)', 'BIGINT(20)')).toBe(true);
    expect(widensMysqlType('TINYINT', 'SMALLINT')).toBe(true);
    expect(widensMysqlType('INT UNSIGNED', 'BIGINT UNSIGNED')).toBe(true);
    expect(widensMysqlType('INT(11)', 'INT')).toBe(true);
    expect(widensMysqlType('BIGINT', 'INT')).toBe(false);
    expect(widensMysqlType('MEDIUMINT', 'SMALLINT')).toBe(false);
  });

  it('does not let an integer lose its sign, or an unsigned one keep its size', () => {
    expect(widensMysqlType('INT', 'INT UNSIGNED')).toBe(false);
    expect(widensMysqlType('INT', 'BIGINT UNSIGNED')).toBe(false);
    expect(widensMysqlType('INT UNSIGNED', 'INT')).toBe(false);
    expect(widensMysqlType('INT UNSIGNED', 'BIGINT')).toBe(true);
  });

  it('takes starting or stopping to count for no change of what fits', () => {
    expect(widensMysqlType('BIGINT UNSIGNED', 'BIGINT UNSIGNED AUTO_INCREMENT')).toBe(true);
    expect(widensMysqlType('INT AUTO_INCREMENT', 'BIGINT')).toBe(true);
  });

  it('holds for a longer text', () => {
    expect(widensMysqlType('VARCHAR(32)', 'VARCHAR(64)')).toBe(true);
    expect(widensMysqlType('CHAR(3)', 'VARCHAR(3)')).toBe(true);
    expect(widensMysqlType('CHAR(2)', 'CHAR(3)')).toBe(true);
    expect(widensMysqlType('VARCHAR(255)', 'TEXT')).toBe(true);
    expect(widensMysqlType('TEXT', 'LONGTEXT')).toBe(true);
    expect(widensMysqlType('BLOB', 'MEDIUMBLOB')).toBe(true);
    expect(widensMysqlType('VARCHAR(64)', 'VARCHAR(32)')).toBe(false);
    expect(widensMysqlType('VARCHAR(300)', 'TINYTEXT')).toBe(false);
    expect(widensMysqlType('LONGTEXT', 'TEXT')).toBe(false);
    expect(widensMysqlType('TEXT', 'VARCHAR(255)')).toBe(false);
  });

  it('holds for a decimal with room for every digit on both sides of the point', () => {
    expect(widensMysqlType('DECIMAL(10,2)', 'DECIMAL(12,2)')).toBe(true);
    expect(widensMysqlType('NUMERIC(10,2)', 'DECIMAL(12,4)')).toBe(true);
    expect(widensMysqlType('DECIMAL', 'DECIMAL(10,0)')).toBe(true);
    expect(widensMysqlType('DECIMAL(12,2)', 'DECIMAL(10,2)')).toBe(false);
    expect(widensMysqlType('DECIMAL(12,2)', 'DECIMAL')).toBe(false);
    expect(widensMysqlType('DECIMAL(12,2)', 'DECIMAL(12,2) UNSIGNED')).toBe(false);
  });

  it('does not vouch for a change between kinds of types', () => {
    expect(widensMysqlType("ENUM('a','b')", 'VARCHAR(20)')).toBe(false);
    expect(widensMysqlType('DATETIME', 'TIMESTAMP')).toBe(false);
    expect(widensMysqlType('INT', 'VARCHAR(20)')).toBe(false);
    expect(widensMysqlType('JSON', 'JSON')).toBe(true);
  });
});
