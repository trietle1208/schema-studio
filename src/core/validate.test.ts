import { describe, expect, it } from 'vitest';
import { ecommerceTables } from './fixtures/ecommerce';
import type { Column, Table } from './model';
import { validateColumns, validateTableName } from './validate';

function sample(name: string): Table {
  const table = ecommerceTables.find((t) => t.name === name);
  if (!table) throw new Error(`No table "${name}" in the ecommerce sample.`);
  return structuredClone(table);
}

function withColumns(name: string, edit: (columns: Column[]) => void): Table {
  const table = sample(name);
  edit(table.columns);
  return table;
}

describe('validateColumns', () => {
  it('finds no problems in the ecommerce sample', () => {
    for (const table of ecommerceTables) {
      expect(validateColumns(table), table.name).toEqual({});
    }
  });

  it('rejects an empty or blank column name', () => {
    const table = withColumns('users', (cols) => {
      cols[2].name = '';
      cols[3].name = '   ';
    });
    expect(validateColumns(table)).toEqual({
      2: 'Column name cannot be empty.',
      3: 'Column name cannot be empty.',
    });
  });

  it('flags the draft column added by "Add column"', () => {
    const table = withColumns('orders', (cols) => {
      cols.push({ name: '', type: 'TEXT', nullable: true, draft: true });
    });
    expect(validateColumns(table)).toEqual({ 5: 'Column name cannot be empty.' });
  });

  it.each(['order items', '1st_login', 'user-id', 'total$', ' email', 'naïve'])('rejects the column name %j', (name) => {
    const table = withColumns('users', (cols) => {
      cols[1].name = name;
    });
    expect(validateColumns(table)).toEqual({ 1: 'Use letters, digits and underscores; start with a letter.' });
  });

  it.each(['_internal', 'Email', 'address_line_2', 'x'])('accepts the column name %j', (name) => {
    const table = withColumns('users', (cols) => {
      cols[1].name = name;
    });
    expect(validateColumns(table)).toEqual({});
  });

  it('reports a duplicate on the later column and names the table', () => {
    const table = withColumns('users', (cols) => {
      cols[3].name = 'email';
    });
    expect(validateColumns(table)).toEqual({ 3: 'Column "email" already exists in users.' });
  });

  it('reports every repeat of a name after the first', () => {
    const table = withColumns('order_items', (cols) => {
      cols[2].name = 'order_id';
      cols[4].name = 'order_id';
    });
    expect(validateColumns(table)).toEqual({
      2: 'Column "order_id" already exists in order_items.',
      4: 'Column "order_id" already exists in order_items.',
    });
  });

  it('does not mistake Object.prototype members for duplicates', () => {
    const table = withColumns('products', (cols) => {
      cols[1].name = 'constructor';
      cols[2].name = 'toString';
      cols[3].name = '__proto__';
    });
    expect(validateColumns(table)).toEqual({});
  });

  it('requires a data type', () => {
    const table = withColumns('payments', (cols) => {
      cols[2].type = '';
    });
    expect(validateColumns(table)).toEqual({ 2: 'Choose a data type.' });
  });

  it('reports the name problem before the missing type', () => {
    const table = withColumns('payments', (cols) => {
      cols[2].name = '';
      cols[2].type = '';
      cols[3].name = 'paid at';
      cols[3].type = '';
    });
    expect(validateColumns(table)).toEqual({
      2: 'Column name cannot be empty.',
      3: 'Use letters, digits and underscores; start with a letter.',
    });
  });

  it('does not modify the table', () => {
    const table = withColumns('users', (cols) => {
      cols[3].name = 'email';
    });
    const before = structuredClone(table);
    validateColumns(table);
    expect(table).toEqual(before);
  });
});

describe('validateTableName', () => {
  const names = ecommerceTables.map((t) => t.name);

  it('accepts every table name in the ecommerce sample', () => {
    for (const name of names) {
      expect(
        validateTableName(
          name,
          names.filter((n) => n !== name),
        ),
        name,
      ).toBeNull();
    }
  });

  it('rejects an empty or blank name', () => {
    expect(validateTableName('')).toBe('Table name cannot be empty.');
    expect(validateTableName('  ', names)).toBe('Table name cannot be empty.');
  });

  it.each(['order items', '2fa_codes', 'order-items', 'public.orders'])('rejects the table name %j', (name) => {
    expect(validateTableName(name, names)).toBe('Use letters, digits and underscores; start with a letter.');
  });

  it('rejects a name another table already uses', () => {
    expect(validateTableName('orders', names)).toBe('Table "orders" already exists.');
  });

  it('accepts a new name', () => {
    expect(validateTableName('order_refunds', names)).toBeNull();
    expect(validateTableName('orders_copy', names)).toBeNull();
  });

  it('does not mistake Object.prototype members for existing tables', () => {
    expect(validateTableName('constructor', names)).toBeNull();
  });
});
