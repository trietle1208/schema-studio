import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, previousSnapshot, withColumn, withTable } from './fixtures/testing';
import type { SchemaSnapshot } from './model';
import { changeMessage, filterVersions, versionEntries, versionLabel, versionMessage, versionSummary, type SavedVersion } from './versions';

const HOUR = 3_600_000;
const NOW = new Date(2026, 9, 6, 8, 14).getTime();

const widened = (): SchemaSnapshot => ({
  ...ecommerceSnapshot(),
  tables: withTable(ecommerceSnapshot().tables, 'orders', (t) => withColumn(t, 'status', { type: 'VARCHAR(80)' })),
});

/** Three versions as the database lists them: the design's two, then one saved without a message. */
const saved = (): SavedVersion[] => [
  { version: 3, message: '', createdAt: NOW, snapshot: widened() },
  { version: 2, message: 'Normalize order line items', createdAt: NOW - 2 * HOUR, snapshot: ecommerceSnapshot() },
  { version: 1, message: 'Imported from ecommerce_prod.sql', createdAt: NOW - 26 * HOUR, snapshot: previousSnapshot() },
];

describe('versionLabel', () => {
  it('prefixes the number with "v"', () => {
    expect(versionLabel(1)).toBe('v1');
    expect(versionLabel(12)).toBe('v12');
  });
});

describe('versionEntries', () => {
  it('lists the versions newest first, each compared with the one before', () => {
    const entries = versionEntries(saved().reverse());
    expect(entries.map((e) => [e.version, e.previous])).toEqual([
      [3, 2],
      [2, 1],
      [1, null],
    ]);
    expect(entries.map((e) => e.stats)).toEqual([
      { added: 0, modified: 1, removed: 0 },
      { added: 7, modified: 1, removed: 3 },
      // Everything the first version holds: 5 tables, 5 indexes, 3 foreign keys.
      { added: 13, modified: 0, removed: 0 },
    ]);
    expect(entries[1].groups.map((g) => g.group)).toEqual(['Tables', 'Columns', 'Indexes', 'Relationships']);
  });

  it('compares with the version that is there when one in between is missing', () => {
    const entries = versionEntries([saved()[0], saved()[2]]);
    expect(entries[0].previous).toBe(1);
    expect(entries[0].stats).toEqual({ added: 7, modified: 2, removed: 3 });
  });
});

describe('versionMessage', () => {
  it('is the message the version was saved with', () => {
    expect(versionEntries(saved()).map(versionMessage)).toEqual([
      'Change orders.status',
      'Normalize order line items',
      'Imported from ecommerce_prod.sql',
    ]);
  });

  it('says what changed when there is none', () => {
    const [, normalized, first] = versionEntries(saved());
    expect(changeMessage(normalized)).toBe('Add order_items and 10 more changes');
    expect(changeMessage(first)).toBe('Initial version');
    // Only the canvas changed.
    const moved = versionEntries([{ ...saved()[0], snapshot: { ...ecommerceSnapshot(), positions: {} } }, saved()[1]])[0];
    expect(changeMessage(moved)).toBe('No changes to the schema');
  });
});

describe('versionSummary', () => {
  it('is the version as the list shows it', () => {
    const [latest, normalized] = versionEntries(saved());
    expect(versionSummary(normalized, 3, NOW)).toEqual({
      version: 'v2',
      current: false,
      time: '2 hours ago',
      timestamp: 'Oct 6, 2026 · 06:14',
      message: 'Normalize order line items',
      tables: 5,
      relationships: 4,
      indexes: 11,
      added: 7,
      modified: 1,
      removed: 3,
    });
    expect(versionSummary(latest, 3, NOW)).toMatchObject({ version: 'v3', current: true, time: 'just now' });
  });
});

describe('filterVersions', () => {
  const versions = (query: string) => filterVersions(versionEntries(saved()), query).map((e) => e.version);

  it('keeps every version for a blank query', () => {
    expect(versions('  ')).toEqual([3, 2, 1]);
  });

  it('matches the message, ignoring case', () => {
    expect(versions('normalize')).toEqual([2]);
    expect(versions('IMPORTED')).toEqual([1]);
  });

  it('matches the tables, columns and indexes a version changed', () => {
    expect(versions('legacy_orders')).toEqual([2, 1]);
    expect(versions('orders.status')).toEqual([3]);
    expect(versions('sku_unique')).toEqual([2]);
  });

  it('matches a version by its number', () => {
    expect(versions('v1')).toEqual([1]);
    expect(versions('nothing like it')).toEqual([]);
  });
});
