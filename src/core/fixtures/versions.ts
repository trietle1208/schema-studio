import type { Positions, Table } from '../model';
import { ecommercePositions, ecommerceTables } from './ecommerce';

// The version of the ecommerce sample before "Normalize order line items", as the design system's
// diff screen shows it: no `order_items` yet but a `legacy_orders`, no `users.avatar_url`, no
// `products.sku`, and a narrower `orders.total`. Comparing it with the sample gives the changes of
// `sample.diff` in design-system/components/bundle.js.

const legacyOrders: Table = {
  name: 'legacy_orders',
  schema: 'public',
  comment: '',
  columns: [
    { name: 'id', type: 'INTEGER', nullable: false, pk: true },
    { name: 'user_id', type: 'INTEGER', nullable: true, fk: { table: 'users', column: 'id', onDelete: 'SET NULL' } },
    { name: 'items_json', type: 'TEXT', nullable: true },
    { name: 'placed_on', type: 'DATE', nullable: false },
  ],
  indexes: [
    { name: 'legacy_orders_pkey', type: 'PRIMARY KEY', using: 'btree', columns: ['id'] },
    { name: 'legacy_orders_user_id_idx', type: 'INDEX', using: 'btree', columns: ['user_id'] },
  ],
};

function earlier(table: Table): Table {
  if (table.name === 'users') return { ...table, columns: table.columns.filter((c) => c.name !== 'avatar_url') };
  if (table.name === 'orders') {
    return { ...table, columns: table.columns.map((c) => (c.name === 'total' ? { ...c, type: 'DECIMAL(10,2)' } : c)) };
  }
  if (table.name === 'products') {
    return {
      ...table,
      columns: table.columns.filter((c) => c.name !== 'sku'),
      indexes: table.indexes?.filter((i) => i.name !== 'products_sku_unique'),
    };
  }
  return table;
}

export const ecommercePreviousTables: Table[] = [
  ...ecommerceTables.filter((t) => t.name !== 'order_items').map(earlier),
  legacyOrders,
];

export const ecommercePreviousPositions: Positions = {
  users: ecommercePositions.users,
  orders: ecommercePositions.orders,
  products: ecommercePositions.products,
  payments: ecommercePositions.payments,
  legacy_orders: ecommercePositions.order_items,
};
