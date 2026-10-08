import type { MysqlCatalog, PostgresCatalog } from '../introspect/catalog';

// What the connection bridge answered for two real databases, PostgreSQL 16 and MySQL 8.0, each
// loaded with the ecommerce sample (`ecommerceSql`, `ecommerceMysqlDump`). The PostgreSQL one also
// has what the model has no place for: a CHECK constraint, an enum type, an identity and a
// generated column, an index on an expression and a composite foreign key.

export const postgresCatalog: PostgresCatalog = {
  engine: 'PostgreSQL',
  schema: 'public',
  tables: [
    { name: 'users', comment: 'Registered customers. One row per account.' },
    { name: 'orders', comment: 'Customer orders. Totals are stored, not derived.' },
    { name: 'products', comment: 'Sellable catalogue items.' },
    { name: 'order_items', comment: null },
    { name: 'payments', comment: null },
    { name: 'Support Tickets', comment: null },
    { name: 'order_notes', comment: null },
    { name: 'note_flags', comment: null },
  ],
  columns: [
    { table: 'users', name: 'id', type: 'bigint', notNull: true, default: "nextval('public.users_id_seq'::regclass)", identity: '', generated: '', comment: null },
    { table: 'users', name: 'email', type: 'character varying(255)', notNull: true, default: null, identity: '', generated: '', comment: "Lower-cased; it's the login." },
    { table: 'users', name: 'name', type: 'character varying(255)', notNull: false, default: null, identity: '', generated: '', comment: null },
    { table: 'users', name: 'avatar_url', type: 'text', notNull: false, default: null, identity: '', generated: '', comment: null },
    { table: 'users', name: 'created_at', type: 'timestamp without time zone', notNull: true, default: 'now()', identity: '', generated: '', comment: null },
    { table: 'orders', name: 'id', type: 'bigint', notNull: true, default: "nextval('public.orders_id_seq'::regclass)", identity: '', generated: '', comment: null },
    { table: 'orders', name: 'user_id', type: 'bigint', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'orders', name: 'status', type: 'character varying(50)', notNull: true, default: "'pending'::character varying", identity: '', generated: '', comment: null },
    { table: 'orders', name: 'total', type: 'numeric(12,2)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'orders', name: 'created_at', type: 'timestamp without time zone', notNull: true, default: 'now()', identity: '', generated: '', comment: null },
    { table: 'products', name: 'id', type: 'bigint', notNull: true, default: "nextval('public.products_id_seq'::regclass)", identity: '', generated: '', comment: null },
    { table: 'products', name: 'name', type: 'character varying(255)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'products', name: 'sku', type: 'character varying(100)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'products', name: 'price', type: 'numeric(12,2)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'order_items', name: 'id', type: 'bigint', notNull: true, default: "nextval('public.order_items_id_seq'::regclass)", identity: '', generated: '', comment: null },
    { table: 'order_items', name: 'order_id', type: 'bigint', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'order_items', name: 'product_id', type: 'bigint', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'order_items', name: 'quantity', type: 'integer', notNull: true, default: '1', identity: '', generated: '', comment: null },
    { table: 'order_items', name: 'price', type: 'numeric(12,2)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'payments', name: 'id', type: 'bigint', notNull: true, default: "nextval('public.payments_id_seq'::regclass)", identity: '', generated: '', comment: null },
    { table: 'payments', name: 'order_id', type: 'bigint', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'payments', name: 'provider', type: 'character varying(32)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'payments', name: 'amount', type: 'numeric(12,2)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'payments', name: 'paid_at', type: 'timestamp with time zone', notNull: false, default: null, identity: '', generated: '', comment: null },
    { table: 'Support Tickets', name: 'id', type: 'bigint', notNull: true, default: null, identity: 'd', generated: '', comment: null },
    { table: 'Support Tickets', name: 'order', type: 'bigint', notNull: false, default: null, identity: '', generated: '', comment: null },
    { table: 'Support Tickets', name: 'state', type: 'public.ticket_state', notNull: true, default: "'open'::public.ticket_state", identity: '', generated: '', comment: null },
    { table: 'Support Tickets', name: 'subject', type: 'character varying(200)', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'Support Tickets', name: 'tags', type: 'text[]', notNull: false, default: "'{}'::text[]", identity: '', generated: '', comment: null },
    { table: 'Support Tickets', name: 'opened_at', type: 'timestamp with time zone', notNull: true, default: 'now()', identity: '', generated: '', comment: null },
    { table: 'Support Tickets', name: 'subject_length', type: 'integer', notNull: false, default: 'length((subject)::text)', identity: '', generated: 's', comment: null },
    { table: 'order_notes', name: 'order_id', type: 'bigint', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'order_notes', name: 'line', type: 'integer', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'order_notes', name: 'body', type: 'text', notNull: false, default: null, identity: '', generated: '', comment: null },
    { table: 'note_flags', name: 'order_id', type: 'bigint', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'note_flags', name: 'line', type: 'integer', notNull: true, default: null, identity: '', generated: '', comment: null },
    { table: 'note_flags', name: 'flag', type: 'smallint', notNull: true, default: '0', identity: '', generated: '', comment: null },
  ],
  constraints: [
    { table: 'users', name: 'users_pkey', kind: 'p', definition: 'PRIMARY KEY (id)' },
    { table: 'orders', name: 'orders_pkey', kind: 'p', definition: 'PRIMARY KEY (id)' },
    { table: 'orders', name: 'orders_total_check', kind: 'c', definition: 'CHECK ((total >= (0)::numeric))' },
    { table: 'orders', name: 'orders_user_id_fkey', kind: 'f', definition: 'FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE' },
    { table: 'products', name: 'products_pkey', kind: 'p', definition: 'PRIMARY KEY (id)' },
    { table: 'products', name: 'products_sku_unique', kind: 'u', definition: 'UNIQUE (sku)' },
    { table: 'order_items', name: 'order_items_order_id_fkey', kind: 'f', definition: 'FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE' },
    { table: 'order_items', name: 'order_items_pkey', kind: 'p', definition: 'PRIMARY KEY (id)' },
    { table: 'order_items', name: 'order_items_product_id_fkey', kind: 'f', definition: 'FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT' },
    { table: 'payments', name: 'payments_order_id_fkey', kind: 'f', definition: 'FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE RESTRICT' },
    { table: 'payments', name: 'payments_pkey', kind: 'p', definition: 'PRIMARY KEY (id)' },
    { table: 'Support Tickets', name: 'Support Tickets_order_fkey', kind: 'f', definition: 'FOREIGN KEY ("order") REFERENCES public.orders(id) ON DELETE SET NULL' },
    { table: 'Support Tickets', name: 'Support Tickets_pkey', kind: 'p', definition: 'PRIMARY KEY (id)' },
    { table: 'order_notes', name: 'order_notes_pkey', kind: 'p', definition: 'PRIMARY KEY (order_id, line)' },
    { table: 'note_flags', name: 'note_flags_order_id_line_fkey', kind: 'f', definition: 'FOREIGN KEY (order_id, line) REFERENCES public.order_notes(order_id, line)' },
  ],
  indexes: [
    { table: 'users', definition: 'CREATE INDEX users_created_at_idx ON public.users USING btree (created_at)' },
    { table: 'users', definition: 'CREATE UNIQUE INDEX users_email_unique ON public.users USING btree (email)' },
    { table: 'orders', definition: 'CREATE INDEX orders_status_created_idx ON public.orders USING btree (status, created_at)' },
    { table: 'orders', definition: 'CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id)' },
    { table: 'order_items', definition: 'CREATE INDEX order_items_order_id_idx ON public.order_items USING btree (order_id)' },
    { table: 'Support Tickets', definition: 'CREATE INDEX tickets_subject_lower_idx ON public."Support Tickets" USING btree (lower((subject)::text))' },
    { table: 'Support Tickets', definition: 'CREATE INDEX tickets_tags_idx ON public."Support Tickets" USING gin (tags)' },
  ],
};

export const mysqlCatalog: MysqlCatalog = {
  engine: 'MySQL',
  database: 'shop',
  tables: [
    {
      name: 'order_items',
      ddl: `CREATE TABLE \`order_items\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`order_id\` bigint unsigned NOT NULL,
  \`product_id\` bigint unsigned NOT NULL,
  \`quantity\` int NOT NULL DEFAULT '1',
  \`price\` decimal(12,2) NOT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`order_items_order_id_idx\` (\`order_id\`),
  KEY \`order_items_product_id_fk\` (\`product_id\`),
  CONSTRAINT \`order_items_order_id_fk\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`order_items_product_id_fk\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    {
      name: 'orders',
      ddl: `CREATE TABLE \`orders\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint unsigned NOT NULL,
  \`status\` enum('pending','paid','shipped') CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  \`total\` decimal(12,2) NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`orders_user_id_idx\` (\`user_id\`),
  KEY \`orders_status_created_idx\` (\`status\`,\`created_at\`),
  CONSTRAINT \`orders_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`orders_total_check\` CHECK ((\`total\` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer orders. Totals are stored, not derived.'`,
    },
    {
      name: 'payments',
      ddl: `CREATE TABLE \`payments\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`order_id\` bigint unsigned NOT NULL,
  \`provider\` varchar(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  \`amount\` decimal(12,2) NOT NULL,
  \`paid_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`payments_order_id_fk\` (\`order_id\`),
  CONSTRAINT \`payments_order_id_fk\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    },
    {
      name: 'products',
      ddl: `CREATE TABLE \`products\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  \`sku\` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  \`price\` decimal(12,2) NOT NULL,
  \`description\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`products_sku_unique\` (\`sku\`),
  FULLTEXT KEY \`products_search\` (\`name\`,\`description\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sellable catalogue items.'`,
    },
    {
      name: 'users',
      ddl: `CREATE TABLE \`users\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`email\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Lower-cased; it''s the login.',
  \`name\` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`avatar_url\` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_unique\` (\`email\`),
  KEY \`users_created_at_idx\` (\`created_at\`)
) ENGINE=InnoDB AUTO_INCREMENT=1042 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registered customers. One row per account.'`,
    },
  ],
};
