import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, previousSnapshot, withColumn, withTable } from '../fixtures/testing';
import { postgresGenerator } from '../generate/postgres';
import type { Table } from '../model';
import { changedPart, compareDdl, hasDifferences, unifiedDiff, type DdlRow } from './ddl';

const sample = () => ecommerceSnapshot().tables;
const previous = () => previousSnapshot().tables;
const compare = (before: readonly Table[], after: readonly Table[]) =>
  compareDdl(postgresGenerator.blocks(before), postgresGenerator.blocks(after));

/** The rows from the one whose left or right line is `line`, `count` of them. */
function rowsFrom(rows: DdlRow[], line: string, count: number): DdlRow[] {
  const start = rows.findIndex((row) => row[0] === line || row[1] === line);
  if (start < 0) throw new Error(`No row "${line}".`);
  return rows.slice(start, start + count);
}

/** One side of the comparison as the script it came from, with the folded lines as one line. */
function side(rows: DdlRow[], which: 'left' | 'right'): string[] {
  return rows.flatMap((row) => {
    if (row[2] === 'fold') return [`fold ${row[3]}`];
    const line = which === 'left' || row[1] === undefined ? row[0] : row[1];
    return line === null ? [] : [line];
  });
}

describe('compareDdl', () => {
  it('folds a schema compared with itself into one row', () => {
    const { rows } = compare(sample(), sample());
    const lines = postgresGenerator.generate(sample()).trimEnd().split('\n').length;
    expect(rows).toEqual([[`⋯ 5 unchanged tables · ${lines} lines`, undefined, 'fold', lines]]);
    expect(hasDifferences(rows)).toBe(false);
  });

  it('shows an added column on the right, with a gap on the left', () => {
    const { rows } = compare(previous(), sample());
    expect(rowsFrom(rows, 'CREATE TABLE users (', 8)).toEqual([
      ['CREATE TABLE users ('],
      ['  id          BIGSERIAL PRIMARY KEY,'],
      ['  email       VARCHAR(255) NOT NULL,'],
      ['  name        VARCHAR(255),'],
      [null, '  avatar_url  TEXT,', 'add'],
      ['  created_at  TIMESTAMP NOT NULL DEFAULT now()'],
      [');'],
      ["COMMENT ON TABLE users IS 'Registered customers. One row per account.';"],
    ]);
    expect(hasDifferences(rows)).toBe(true);
  });

  it('shows a changed column as one row with both lines', () => {
    const { rows } = compare(previous(), sample());
    expect(rowsFrom(rows, '  total       DECIMAL(10,2) NOT NULL,', 1)).toEqual([
      ['  total       DECIMAL(10,2) NOT NULL,', '  total       DECIMAL(12,2) NOT NULL,', 'mod'],
    ]);
  });

  it('shows an added table on the right only and a removed one on the left only', () => {
    const { rows } = compare(previous(), sample());
    expect(rowsFrom(rows, 'CREATE TABLE order_items (', 3)).toEqual([
      [null, 'CREATE TABLE order_items (', 'add'],
      [null, '  id          BIGSERIAL PRIMARY KEY,', 'add'],
      [null, '  order_id    BIGINT NOT NULL,', 'add'],
    ]);
    expect(rowsFrom(rows, 'CREATE TABLE legacy_orders (', 2)).toEqual([
      ['CREATE TABLE legacy_orders (', null, 'del'],
      ['  id          INTEGER PRIMARY KEY,', null, 'del'],
    ]);
    // The blank line before a block is on the side that has the block.
    expect(rows[rows.findIndex((row) => row[1] === 'CREATE TABLE order_items (') - 1]).toEqual([null, '', 'add']);
    expect(rows[rows.findIndex((row) => row[0] === 'CREATE TABLE legacy_orders (') - 1]).toEqual(['', null, 'del']);
  });

  it('folds the blocks that did not change and counts their tables', () => {
    const folds = compare(previous(), sample()).rows.filter((row) => row[2] === 'fold');
    expect(folds).toContainEqual(['⋯ 1 unchanged table · 8 lines', undefined, 'fold', 8]);
    expect(folds).toContainEqual(['⋯ 7 unchanged lines', undefined, 'fold', 7]);
  });

  it('keeps every line of both scripts, in order', () => {
    const { rows } = compare(previous(), sample());
    const unfolded = (script: string, shown: string[]) => {
      const lines = script.trimEnd().split('\n');
      let at = 0;
      for (const line of shown) {
        const fold = /^fold (\d+)$/.exec(line);
        if (fold) at += Number(fold[1]);
        else expect(lines[at++]).toBe(line);
      }
      expect(at).toBe(lines.length);
    };
    // The removed blocks are shown where they were, so the left side is checked block by block.
    unfolded(postgresGenerator.generate(sample()), side(rows, 'right'));
    expect(side(rows, 'left').filter((line) => !line.startsWith('fold'))).toEqual(
      expect.arrayContaining(['CREATE TABLE legacy_orders (', '  ON DELETE SET NULL;']),
    );
  });

  it('does not count the padding of the columns or a comma at the end as a change', () => {
    // A long name pads every line of the table again, and the last column gains a comma.
    const longer = withTable(sample(), 'products', (t) => ({
      ...t,
      columns: [...t.columns, { name: 'discontinued_at', type: 'TIMESTAMP', nullable: true }],
    }));
    const { rows } = compare(sample(), longer);
    expect(rowsFrom(rows, '  price  DECIMAL(12,2) NOT NULL', 2)).toEqual([
      ['  price  DECIMAL(12,2) NOT NULL', '  price            DECIMAL(12,2) NOT NULL,', 'same'],
      [null, '  discontinued_at  TIMESTAMP', 'add'],
    ]);
    expect(rows.filter((row) => row[2] === 'add' || row[2] === 'mod' || row[2] === 'del')).toHaveLength(1);
  });

  it('points every block at its first row, and a folded block at its fold', () => {
    const { rows, anchors } = compare(previous(), sample());
    expect(rows[anchors['table:users']]).toEqual(['CREATE TABLE users (']);
    expect(rows[anchors['table:order_items']]).toEqual([null, 'CREATE TABLE order_items (', 'add']);
    expect(rows[anchors['table:legacy_orders']]).toEqual(['CREATE TABLE legacy_orders (', null, 'del']);
    expect(rows[anchors['index:products.products_sku_unique']]).toEqual([null, 'CREATE UNIQUE INDEX products_sku_unique', 'add']);
    expect(rows[anchors['fk:legacy_orders.user_id']]).toEqual(['ALTER TABLE legacy_orders', null, 'del']);
    expect(rows[anchors['table:payments']][2]).toBe('fold');
  });

  it('shows a changed comment beside its earlier self', () => {
    const edited = withTable(sample(), 'users', (t) => ({ ...withColumn(t, 'email', { comment: 'Lower case.' }), comment: 'Customers.' }));
    const first = withTable(sample(), 'users', (t) => withColumn(t, 'email', { comment: 'Unique per account.' }));
    const { rows } = compare(first, edited);
    expect(rows.filter((row) => row[2] === 'mod')).toEqual([
      ["COMMENT ON TABLE users IS 'Registered customers. One row per account.';", "COMMENT ON TABLE users IS 'Customers.';", 'mod'],
      ["COMMENT ON COLUMN users.email IS 'Unique per account.';", "COMMENT ON COLUMN users.email IS 'Lower case.';", 'mod'],
    ]);
  });
});

describe('unifiedDiff', () => {
  const unfolded = (before: readonly Table[], after: readonly Table[]) =>
    compareDdl(postgresGenerator.blocks(before), postgresGenerator.blocks(after), { fold: false }).rows;

  it('writes the changes as hunks with three lines of context and the line numbers of both sides', () => {
    const diff = unifiedDiff(unfolded(previous(), sample()), 'a/ecommerce_v11.sql', 'b/ecommerce_v12.sql');
    expect(diff.startsWith(`--- a/ecommerce_v11.sql
+++ b/ecommerce_v12.sql
@@ -2,6 +2,7 @@
   id          BIGSERIAL PRIMARY KEY,
   email       VARCHAR(255) NOT NULL,
   name        VARCHAR(255),
+  avatar_url  TEXT,
   created_at  TIMESTAMP NOT NULL DEFAULT now()
 );
 COMMENT ON TABLE users IS 'Registered customers. One row per account.';
@@ -16,7 +17,7 @@
`)).toBe(true);
    expect(diff).toContain('-  total       DECIMAL(10,2) NOT NULL,\n+  total       DECIMAL(12,2) NOT NULL,\n');
    expect(diff).toContain('-CREATE TABLE legacy_orders (\n');
  });

  it('counts a line that differs by its padding or a comma as changed, as a patch has to match the file', () => {
    const longer = withTable(sample(), 'products', (t) => ({
      ...t,
      columns: [...t.columns, { name: 'discontinued_at', type: 'TIMESTAMP', nullable: true }],
    }));
    expect(unifiedDiff(unfolded(sample(), longer), 'old', 'new')).toContain(`-  id     BIGSERIAL PRIMARY KEY,
+  id               BIGSERIAL PRIMARY KEY,
-  name   VARCHAR(255) NOT NULL,
+  name             VARCHAR(255) NOT NULL,
-  sku    VARCHAR(100) NOT NULL,
+  sku              VARCHAR(100) NOT NULL,
-  price  DECIMAL(12,2) NOT NULL
+  price            DECIMAL(12,2) NOT NULL,
+  discontinued_at  TIMESTAMP
 );
`);
  });

  it('puts changes whose context meets into one hunk, and numbers each hunk by the lines before it', () => {
    const line = (n: number): DdlRow => [`l${n}`];
    const rows: DdlRow[] = [line(1), line(2), line(3), line(4), [null, 'new', 'add'], line(5), line(6), ['old', null, 'del'], ...[7, 8, 9, 10, 11, 12, 13, 14].map(line), ['a', 'b', 'mod'], line(15)];
    expect(unifiedDiff(rows, 'old', 'new')).toBe(`--- old
+++ new
@@ -2,9 +2,9 @@
 l2
 l3
 l4
+new
 l5
 l6
-old
 l7
 l8
 l9
@@ -13,5 +13,5 @@
 l12
 l13
 l14
-a
+b
 l15
`);
  });

  it('counts a side without lines from the line before, and takes less context with a smaller number', () => {
    expect(unifiedDiff([[null, 'b', 'add']], 'old', 'new')).toBe('--- old\n+++ new\n@@ -0,0 +1,1 @@\n+b\n');
    expect(unifiedDiff([['a'], ['b'], ['c', null, 'del'], ['d'], ['e']], 'old', 'new', 1)).toBe('--- old\n+++ new\n@@ -2,3 +2,2 @@\n b\n-c\n d\n');
  });

  it('skips the lines of a fold when it is given one', () => {
    const rows: DdlRow[] = [['⋯ 3 unchanged lines', undefined, 'fold', 3], ['a'], [null, 'b', 'add']];
    expect(unifiedDiff(rows, 'old', 'new')).toBe('--- old\n+++ new\n@@ -4,1 +4,2 @@\n a\n+b\n');
  });

  it('has only its heading when nothing differs', () => {
    expect(unifiedDiff(unfolded(sample(), sample()), 'old', 'new')).toBe('--- old\n+++ new\n');
  });
});

describe('compareDdl without folding', () => {
  it('keeps every line of both scripts', () => {
    const { rows } = compareDdl(postgresGenerator.blocks(previous()), postgresGenerator.blocks(sample()), { fold: false });
    expect(rows.some((row) => row[2] === 'fold')).toBe(false);
    expect(side(rows, 'left')).toEqual(expect.arrayContaining(postgresGenerator.generate(previous()).trimEnd().split('\n')));
    expect(side(rows, 'right')).toEqual(postgresGenerator.generate(sample()).trimEnd().split('\n'));
  });
});

describe('changedPart', () => {
  it('finds what differs between the shared start and end of two lines', () => {
    expect(changedPart('  total      DECIMAL(10,2) NOT NULL,', '  total      DECIMAL(12,2) NOT NULL,')).toEqual({
      pre: '  total      DECIMAL(1',
      before: '0',
      after: '2',
      post: ',2) NOT NULL,',
    });
  });

  it('has an empty side where text was only added or only removed', () => {
    expect(changedPart('  name  TEXT,', '  name  TEXT NOT NULL,')).toEqual({ pre: '  name  TEXT', before: '', after: ' NOT NULL', post: ',' });
    expect(changedPart('aaa', 'aa')).toEqual({ pre: 'aa', before: 'a', after: '', post: '' });
    expect(changedPart('same', 'same')).toEqual({ pre: 'same', before: '', after: '', post: '' });
  });
});
