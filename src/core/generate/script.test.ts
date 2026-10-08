import { describe, expect, it } from 'vitest';
import { ecommerceSnapshot, inferredTables, withColumn, withTable } from '../fixtures/testing';
import { convertTables } from './convert';
import { mysqlGenerator } from './mysql';
import { postgresGenerator } from './postgres';
import { tableScript } from './script';

describe('tableScript', () => {
  it('is everything that makes one table: its CREATE TABLE, its indexes and its foreign keys', () => {
    expect(tableScript(postgresGenerator, ecommerceSnapshot().tables, 'orders')).toBe(`CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',
  total       DECIMAL(12,2) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE orders IS 'Customer orders. Totals are stored, not derived.';

CREATE INDEX orders_user_id_idx
  ON orders (user_id);

CREATE INDEX orders_status_created_idx
  ON orders (status, created_at);

ALTER TABLE orders
  ADD CONSTRAINT orders_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users (id)
  ON DELETE CASCADE;
`);
  });

  it('has the foreign keys of the table, not the ones other tables have on it', () => {
    const script = tableScript(postgresGenerator, ecommerceSnapshot().tables, 'order_items');
    expect(script.match(/^ALTER TABLE .*$/gm)).toEqual(['ALTER TABLE order_items', 'ALTER TABLE order_items']);
    expect(script).toContain('REFERENCES orders (id)');
    expect(script).toContain('REFERENCES products (id)');
    expect(tableScript(postgresGenerator, ecommerceSnapshot().tables, 'users')).not.toContain('ALTER TABLE');
  });

  it('is written the way the generator of the engine writes the whole script, without what goes around it', () => {
    const tables = convertTables(ecommerceSnapshot().tables, 'PostgreSQL', 'MySQL');
    const script = tableScript(mysqlGenerator, tables, 'payments');
    expect(script).toBe(`CREATE TABLE \`payments\` (
  \`id\`        BIGINT AUTO_INCREMENT PRIMARY KEY,
  \`order_id\`  BIGINT NOT NULL,
  \`provider\`  VARCHAR(32) NOT NULL,
  \`amount\`    DECIMAL(12,2) NOT NULL,
  \`paid_at\`   TIMESTAMP
);

ALTER TABLE \`payments\`
  ADD CONSTRAINT \`payments_order_id_fkey\`
  FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`)
  ON DELETE RESTRICT;
`);
    // Every block of it is in the script of the schema.
    for (const block of script.trimEnd().split('\n\n')) expect(mysqlGenerator.generate(tables)).toContain(block);
  });

  it('leaves out an inferred foreign key, and says which declared one it could not write', () => {
    expect(tableScript(postgresGenerator, inferredTables(), 'payments')).not.toContain('FOREIGN KEY');

    const tables = withTable(ecommerceSnapshot().tables, 'payments', (t) =>
      withColumn(t, 'order_id', { fk: { table: 'invoices', column: 'id' } }),
    );
    expect(tableScript(postgresGenerator, tables, 'payments')).toContain(
      '-- Foreign key payments.order_id was left out: invoices does not exist.',
    );
  });

  it('is empty for a table the schema does not have', () => {
    expect(tableScript(postgresGenerator, ecommerceSnapshot().tables, 'invoices')).toBe('');
  });
});
