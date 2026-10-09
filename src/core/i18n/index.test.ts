import { afterEach, describe, expect, it } from 'vitest';
import { diffGroupLabel, diffGroups, diffSchemas } from '../diff';
import { ecommerceTables } from '../fixtures/ecommerce';
import { missingCommaSql } from '../fixtures/sql';
import { ecommerceSnapshot, previousSnapshot } from '../fixtures/testing';
import { migratorFor } from '../generate';
import { parserFor } from '../parse';
import { summarize } from '../summary';
import { dateTime, relativeTime } from '../time';
import { validateColumns, validateTableName } from '../validate';
import { changeMessage, versionEntries } from '../versions';
import { en } from './en';
import { anyOf, DEFAULT_LOCALE, getLocale, isMessageKey, LOCALES, messageText, parseLocale, setLocale, t, translate, type MessageKey } from './index';
import { vi } from './vi';

afterEach(() => setLocale(DEFAULT_LOCALE));

const KEYS = Object.keys(en) as MessageKey[];

/** The placeholders of a text, in the order of their names. */
const placeholders = (text: string) => [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))].sort();

/** Every text a message has: its one text, or each of its plural forms. */
const texts = (message: string | Record<string, string>) => (typeof message === 'string' ? [message] : Object.values(message));

describe('parseLocale', () => {
  it('reads the languages the settings offer', () => {
    expect(LOCALES.map((l) => parseLocale(l.value))).toEqual(['en', 'vi']);
  });

  it('is English for nothing stored and for a value that is no language', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(parseLocale(null)).toBe('en');
    expect(parseLocale(undefined)).toBe('en');
    expect(parseLocale('')).toBe('en');
    expect(parseLocale('VI')).toBe('en');
    expect(parseLocale('fr')).toBe('en');
  });
});

describe('the dictionaries', () => {
  it('have a Vietnamese text for every English message, and no other', () => {
    expect(Object.keys(vi).sort()).toEqual(Object.keys(en).sort());
  });

  it('give a message the same kind in both: one text, or forms by count', () => {
    for (const key of KEYS) expect(typeof vi[key], key).toBe(typeof en[key]);
  });

  it('leave no Vietnamese text blank', () => {
    for (const key of KEYS) {
      for (const text of texts(vi[key])) expect(text.trim(), key).not.toBe('');
    }
  });

  it('use no placeholder in Vietnamese that the English message does not have', () => {
    for (const key of KEYS) {
      const known = new Set(texts(en[key]).flatMap(placeholders));
      for (const text of texts(vi[key])) {
        expect(placeholders(text).filter((name) => !known.has(name)), key).toEqual([]);
      }
    }
  });

  it('keep every placeholder of a message that names something in its Vietnamese text', () => {
    for (const key of KEYS) {
      // A form for one thing may leave the count out in English ("the table"); Vietnamese has one form for every count.
      const wanted = placeholders(typeof en[key] === 'string' ? en[key] : (en[key] as { other: string }).other);
      for (const text of texts(vi[key])) expect(placeholders(text), key).toEqual(wanted);
    }
  });

  it('wrap the same number of names in backticks, which are set as code', () => {
    const ticks = (text: string) => text.split('`').length - 1;
    for (const key of KEYS) {
      const [english] = texts(en[key]);
      for (const text of texts(vi[key])) expect(ticks(text), key).toBe(ticks(english));
    }
  });

  it('give every plural message the form for every other count', () => {
    for (const key of KEYS) {
      for (const dictionary of [en, vi]) {
        const message = dictionary[key];
        if (typeof message !== 'string') expect(message.other, key).toBeTruthy();
      }
    }
  });
});

describe('t', () => {
  it('answers in English until another language is set', () => {
    expect(getLocale()).toBe('en');
    expect(t('validate.columnNameEmpty')).toBe('Column name cannot be empty.');
    setLocale('vi');
    expect(getLocale()).toBe('vi');
    expect(t('validate.columnNameEmpty')).toBe('Tên cột không được để trống.');
  });

  it('puts the values in place of the placeholders', () => {
    expect(t('validate.columnExists', { name: 'email', table: 'users' })).toBe('Column "email" already exists in users.');
    setLocale('vi');
    expect(t('validate.columnExists', { name: 'email', table: 'users' })).toBe('Cột "email" đã tồn tại trong users.');
  });

  it('takes a value as it is, braces and all', () => {
    expect(t('validate.tableExists', { name: '{name} $& $1' })).toBe('Table "{name} $& $1" already exists.');
  });

  it('picks the form of a message by its count', () => {
    expect(t('count.tables', { count: 0 })).toBe('0 tables');
    expect(t('count.tables', { count: 1 })).toBe('1 table');
    expect(t('count.tables', { count: 24 })).toBe('24 tables');
    expect(t('count.indexes', { count: 1 })).toBe('1 index');
    expect(t('count.indexes', { count: 18 })).toBe('18 indexes');
    expect(t('unit.tables', { count: 1 })).toBe('table');
    setLocale('vi');
    expect(t('count.tables', { count: 1 })).toBe('1 bảng');
    expect(t('count.tables', { count: 24 })).toBe('24 bảng');
  });

  it('is told apart from translate, which answers in the language it is asked for', () => {
    setLocale('vi');
    expect(translate('en', 'migration.dropData', { path: 'legacy_orders' })).toBe('Dropping legacy_orders deletes its data.');
    expect(translate('vi', 'migration.dropData', { path: 'legacy_orders' })).toBe('Xóa legacy_orders sẽ làm mất dữ liệu của nó.');
  });
});

describe('messageText', () => {
  it('leaves the placeholders in, for a caller that puts elements in their place', () => {
    expect(messageText('en', 'dropzone.title')).toBe('Drop SQL file here or {browse}');
    expect(messageText('en', 'workspace.focus', 1)).toBe('Showing {table} and {count} related table');
    expect(messageText('en', 'workspace.focus', 3)).toBe('Showing {table} and {count} related tables');
    expect(messageText('vi', 'workspace.focus', 1)).toBe('Đang hiện {table} và {count} bảng liên quan');
  });
});

describe('isMessageKey', () => {
  it('knows a key that is put together from a value', () => {
    expect(isMessageKey('type.family.integer')).toBe(true);
    expect(isMessageKey('type.family.geometry')).toBe(false);
    expect(isMessageKey('toString')).toBe(false);
  });
});

describe('anyOf', () => {
  it('lists alternatives in the language of the app', () => {
    expect(anyOf([])).toBe('');
    expect(anyOf(['`,`'])).toBe('`,`');
    expect(anyOf(['`,`', '`)`'])).toBe('`,` or `)`');
    expect(anyOf(['`CASCADE`', '`RESTRICT`', '`SET NULL`'])).toBe('`CASCADE`, `RESTRICT` or `SET NULL`');
    setLocale('vi');
    expect(anyOf(['`,`', '`)`'])).toBe('`,` hoặc `)`');
  });
});

describe('the core in Vietnamese', () => {
  const users = ecommerceTables.find((table) => table.name === 'users')!;

  it('validates names', () => {
    setLocale('vi');
    expect(validateTableName('')).toBe('Tên bảng không được để trống.');
    expect(validateTableName('orders', ['orders'])).toBe('Bảng "orders" đã tồn tại.');
    const twice = { ...users, columns: [...users.columns, { ...users.columns[1] }] };
    expect(validateColumns(twice)[users.columns.length]).toBe(`Cột "${users.columns[1].name}" đã tồn tại trong users.`);
  });

  it('counts a schema', () => {
    setLocale('vi');
    expect(summarize(ecommerceTables)).toBe('5 bảng · 4 quan hệ · 11 index');
  });

  it('says how long ago', () => {
    const now = new Date(2026, 9, 6, 8, 14).getTime();
    setLocale('vi');
    expect(relativeTime(now, now)).toBe('vừa xong');
    expect(relativeTime(now - 2 * 3_600_000, now)).toBe('2 giờ trước');
    expect(relativeTime(now - 2 * 3_600_000, now, true)).toBe('2 giờ');
    expect(relativeTime(now - 30 * 3_600_000, now)).toBe('Hôm qua');
    expect(relativeTime(new Date(2026, 7, 28).getTime(), now)).toBe('28 thg 8');
    expect(relativeTime(new Date(2025, 11, 3).getTime(), now)).toBe('3 thg 12, 2025');
    expect(dateTime(now)).toBe('6 thg 10, 2026 · 08:14');
  });

  it('says what a version changed, and keeps the names of the groups it sorts the changes into', () => {
    const previous = previousSnapshot();
    const current = ecommerceSnapshot();
    const entries = versionEntries([
      { version: 1, message: '', createdAt: 0, snapshot: previous },
      { version: 2, message: '', createdAt: 1, snapshot: current },
    ]);
    const english = changeMessage(entries[0]);
    setLocale('vi');
    expect(changeMessage(entries[1])).toBe('Phiên bản đầu tiên');
    expect(changeMessage(entries[0])).not.toBe(english);
    expect(changeMessage(entries[0])).toMatch(/^(Thêm|Sửa|Xóa) /);
    const groups = diffGroups(diffSchemas(previous.tables, current.tables));
    expect(groups.map((g) => g.group).every((name) => ['Tables', 'Columns', 'Indexes', 'Relationships'].includes(name))).toBe(true);
    expect(diffGroupLabel('Columns')).toBe('Cột');
    expect(diffGroupLabel('Views')).toBe('Views');
  });

  it('reports a script that cannot be read, with the line it stopped at', () => {
    const english = parserFor('PostgreSQL')!.parse(missingCommaSql);
    setLocale('vi');
    const outcome = parserFor('PostgreSQL')!.parse(missingCommaSql);
    if (outcome.ok || english.ok) throw new Error('The broken script was read.');
    expect(outcome.error.line).toBe(english.error.line);
    expect(outcome.error.message).toBe(`Không đọc được SQL gần dòng ${outcome.error.line}.`);
    expect(outcome.error.detail).toContain('Hãy sửa câu lệnh hoặc bỏ nó đi để nhập phần còn lại.');
  });

  it('writes a migration in English, and says what it destroys in the language of the app', () => {
    const before = ecommerceTables;
    const after = ecommerceTables.filter((table) => table.name !== 'payments');
    const english = migratorFor('PostgreSQL')!.migrate(before, after);
    setLocale('vi');
    const migration = migratorFor('PostgreSQL')!.migrate(before, after);
    expect(migration.sql).toBe(english.sql);
    expect(migration.sql).toContain('-- Destructive: Dropping payments deletes its data.');
    expect(migration.destructive).toEqual([{ path: 'payments', message: 'Xóa payments sẽ làm mất dữ liệu của nó.' }]);
    const mysql = migratorFor('MySQL')!.migrate(before, after);
    expect(mysql.sql).toContain('Destructive: Dropping payments deletes its data.');
    expect(mysql.destructive[0].message).toBe('Xóa payments sẽ làm mất dữ liệu của nó.');
  });
});
