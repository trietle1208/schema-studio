import type { Table } from '../model';

// The ecommerce sample from design-system/components/bundle.js (`sample.tables`).
export const ecommerceTables: Table[] = [
  {
    name: 'users',
    schema: 'public',
    comment: 'Registered customers. One row per account.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
      { name: 'email', type: 'VARCHAR(255)', nullable: false, unique: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: true },
      { name: 'avatar_url', type: 'TEXT', nullable: true },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'now()' },
    ],
    indexes: [
      { name: 'users_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'users_email_unique', type: 'UNIQUE', using: 'btree', columns: ['email'] },
      { name: 'users_created_at_idx', type: 'INDEX', using: 'btree', columns: ['created_at'] },
    ],
  },
  {
    name: 'orders',
    schema: 'public',
    comment: 'Customer orders. Totals are stored, not derived.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
      { name: 'user_id', type: 'BIGINT', nullable: false, fk: { table: 'users', column: 'id', onDelete: 'CASCADE' } },
      { name: 'status', type: 'VARCHAR(50)', nullable: false, default: "'pending'" },
      { name: 'total', type: 'DECIMAL(12,2)', nullable: false },
      { name: 'created_at', type: 'TIMESTAMP', nullable: false, default: 'now()' },
    ],
    indexes: [
      { name: 'orders_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'orders_user_id_idx', type: 'INDEX', using: 'btree', columns: ['user_id'] },
      { name: 'orders_status_created_idx', type: 'INDEX', using: 'btree', columns: ['status', 'created_at'] },
    ],
  },
  {
    name: 'order_items',
    schema: 'public',
    comment: '',
    columns: [
      { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
      { name: 'order_id', type: 'BIGINT', nullable: false, fk: { table: 'orders', column: 'id', onDelete: 'CASCADE' } },
      { name: 'product_id', type: 'BIGINT', nullable: false, fk: { table: 'products', column: 'id', onDelete: 'RESTRICT' } },
      { name: 'quantity', type: 'INTEGER', nullable: false, default: '1' },
      { name: 'price', type: 'DECIMAL(12,2)', nullable: false },
    ],
    indexes: [
      { name: 'order_items_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'order_items_order_id_idx', type: 'INDEX', using: 'btree', columns: ['order_id'] },
    ],
  },
  {
    name: 'products',
    schema: 'public',
    comment: 'Sellable catalogue items.',
    columns: [
      { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
      { name: 'name', type: 'VARCHAR(255)', nullable: false },
      { name: 'sku', type: 'VARCHAR(100)', nullable: false, unique: true },
      { name: 'price', type: 'DECIMAL(12,2)', nullable: false },
    ],
    indexes: [
      { name: 'products_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
      { name: 'products_sku_unique', type: 'UNIQUE', using: 'btree', columns: ['sku'] },
    ],
  },
  {
    name: 'payments',
    schema: 'public',
    comment: '',
    columns: [
      { name: 'id', type: 'BIGSERIAL', nullable: false, pk: true },
      { name: 'order_id', type: 'BIGINT', nullable: false, fk: { table: 'orders', column: 'id', onDelete: 'RESTRICT' } },
      { name: 'provider', type: 'VARCHAR(32)', nullable: false },
      { name: 'amount', type: 'DECIMAL(12,2)', nullable: false },
      { name: 'paid_at', type: 'TIMESTAMPTZ', nullable: true },
    ],
    indexes: [
      { name: 'payments_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
    ],
  },
];
