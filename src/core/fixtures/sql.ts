// SQL for the tests of the parser and the generator.

/** The ecommerce sample as hand-written DDL. It reads back as `ecommerceTables`, table for table. */
export const ecommerceSql = `-- ecommerce schema
CREATE TABLE users (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL,
  name        VARCHAR(255),
  avatar_url  TEXT,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE users IS 'Registered customers. One row per account.';

CREATE UNIQUE INDEX users_email_unique ON users (email);
CREATE INDEX users_created_at_idx ON users (created_at);

CREATE TABLE orders (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      VARCHAR(50) NOT NULL DEFAULT 'pending',
  total       DECIMAL(12,2) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT now()
);
COMMENT ON TABLE orders IS 'Customer orders. Totals are stored, not derived.';

CREATE INDEX orders_user_id_idx ON orders (user_id);
CREATE INDEX orders_status_created_idx ON orders (status, created_at);

CREATE TABLE products (
  id     BIGSERIAL PRIMARY KEY,
  name   VARCHAR(255) NOT NULL,
  sku    VARCHAR(100) NOT NULL CONSTRAINT products_sku_unique UNIQUE,
  price  DECIMAL(12,2) NOT NULL
);
COMMENT ON TABLE products IS 'Sellable catalogue items.';

CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity    INTEGER NOT NULL DEFAULT 1,
  price       DECIMAL(12,2) NOT NULL
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);

CREATE TABLE payments (
  id        BIGSERIAL PRIMARY KEY,
  order_id  BIGINT NOT NULL,
  provider  VARCHAR(32) NOT NULL,
  amount    DECIMAL(12,2) NOT NULL,
  paid_at   TIMESTAMPTZ
);

ALTER TABLE payments
  ADD CONSTRAINT payments_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES orders (id)
  ON DELETE RESTRICT;
`;

/** Two of the sample's tables the way \`pg_dump --schema-only\` writes them. */
export const ecommerceDump = `--
-- PostgreSQL database dump
--

\\restrict 5rT0pmq1bYw

-- Dumped from database version 16.4
-- Dumped by pg_dump version 16.4

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SELECT pg_catalog.set_config('search_path', '', false);
SET default_tablespace = '';
SET default_table_access_method = heap;

CREATE FUNCTION public.touch() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.created_at := now(); -- not a statement; of the script
  RETURN NEW;
END;
$$;

--
-- Name: users; Type: TABLE; Schema: public; Owner: shop
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255),
    avatar_url text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.users OWNER TO shop;

COMMENT ON TABLE public.users IS 'Registered customers. One row per account.';
COMMENT ON COLUMN public.users.email IS 'Lower-cased; it''s the login.';

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;

CREATE TABLE public.orders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    total numeric(12,2) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT orders_total_check CHECK ((total >= (0)::numeric))
)
WITH (fillfactor='90');

CREATE SEQUENCE public.orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.orders ALTER COLUMN id SET DEFAULT nextval('public.orders_id_seq'::regclass);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);

CREATE INDEX orders_status_created_idx ON public.orders USING btree (status, created_at);
CREATE INDEX orders_user_id_idx ON public.orders USING btree (user_id);
CREATE INDEX users_email_lower_idx ON public.users USING btree (lower((email)::text));

CREATE TRIGGER touch BEFORE INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.touch();

ALTER TABLE ONLY public.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

\\unrestrict 5rT0pmq1bYw

--
-- PostgreSQL database dump complete
--
`;

/** \`sample.badSql\` of the design system: line 4 lacks its comma and the table is never closed. */
export const missingCommaSql = `CREATE TABLE order_items (
  id          BIGSERIAL PRIMARY KEY,
  order_id    BIGINT NOT NULL REFERENCES orders(id),
  product_id  BIGINT NOT NULL REFERENCES products(id)
  quantity    INTEGER NOT NULL DEFAULT 1,
  price       DECIMAL(12,2) NOT NULL`;

/** The ecommerce sample the way \`mysqldump --no-data\` writes it, with the trigger and the comments a dump has around its tables. */
export const ecommerceMysqlDump = `-- MySQL dump 10.13  Distrib 8.0.36, for Linux (x86_64)
--
-- Host: localhost    Database: shop
-- ------------------------------------------------------
-- Server version	8.0.36

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!50503 SET NAMES utf8mb4 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;

--
-- Table structure for table \`users\`
--

DROP TABLE IF EXISTS \`users\`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE \`users\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`email\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'Lower-cased; it''s the login.',
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  \`avatar_url\` text COLLATE utf8mb4_unicode_ci,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`users_email_unique\` (\`email\`),
  KEY \`users_created_at_idx\` (\`created_at\`)
) ENGINE=InnoDB AUTO_INCREMENT=1042 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Registered customers. One row per account.';
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Table structure for table \`orders\`
--

DROP TABLE IF EXISTS \`orders\`;
CREATE TABLE \`orders\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`user_id\` bigint unsigned NOT NULL,
  \`status\` enum('pending','paid','shipped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  \`total\` decimal(12,2) NOT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` timestamp NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (\`id\`),
  KEY \`orders_user_id_idx\` (\`user_id\`),
  KEY \`orders_status_created_idx\` (\`status\`,\`created_at\`),
  CONSTRAINT \`orders_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`orders_total_check\` CHECK ((\`total\` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Customer orders. Totals are stored, not derived.';

DROP TABLE IF EXISTS \`products\`;
CREATE TABLE \`products\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`name\` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`sku\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`price\` decimal(12,2) NOT NULL,
  \`description\` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (\`id\`),
  UNIQUE KEY \`products_sku_unique\` (\`sku\`),
  FULLTEXT KEY \`products_search\` (\`name\`,\`description\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Sellable catalogue items.';

DROP TABLE IF EXISTS \`order_items\`;
CREATE TABLE \`order_items\` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS \`payments\`;
CREATE TABLE \`payments\` (
  \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
  \`order_id\` bigint unsigned NOT NULL,
  \`provider\` varchar(32) COLLATE utf8mb4_unicode_ci NOT NULL,
  \`amount\` decimal(12,2) NOT NULL,
  \`paid_at\` datetime DEFAULT NULL,
  PRIMARY KEY (\`id\`),
  KEY \`payments_order_id_fk\` (\`order_id\`),
  CONSTRAINT \`payments_order_id_fk\` FOREIGN KEY (\`order_id\`) REFERENCES \`orders\` (\`id\`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

LOCK TABLES \`payments\` WRITE;
INSERT INTO \`payments\` VALUES (1,7,'stripe; it\\'s live',19.90,NULL);
UNLOCK TABLES;

DELIMITER ;;
CREATE TRIGGER \`orders_touch\` BEFORE UPDATE ON \`orders\` FOR EACH ROW BEGIN
  SET NEW.updated_at = NOW(); # not a statement; of the script
END ;;
DELIMITER ;

/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;

-- Dump completed on 2026-10-07  9:14:02
`;

/** Two of the sample's tables the way phpMyAdmin exports them: the keys and AUTO_INCREMENT come after the tables, in ALTER TABLE. */
export const ecommercePhpMyAdmin = `-- phpMyAdmin SQL Dump
-- version 5.2.1
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";

CREATE TABLE \`users\` (
  \`id\` int(11) NOT NULL,
  \`email\` varchar(255) NOT NULL,
  \`name\` varchar(255) DEFAULT NULL,
  \`created_at\` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE \`orders\` (
  \`id\` int(11) NOT NULL,
  \`user_id\` int(11) NOT NULL,
  \`status\` varchar(50) NOT NULL DEFAULT 'pending',
  \`total\` decimal(12,2) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Indexes for dumped tables
--

ALTER TABLE \`users\`
  ADD PRIMARY KEY (\`id\`),
  ADD UNIQUE KEY \`users_email_unique\` (\`email\`);

ALTER TABLE \`orders\`
  ADD PRIMARY KEY (\`id\`),
  ADD KEY \`orders_user_id_idx\` (\`user_id\`);

--
-- AUTO_INCREMENT for dumped tables
--

ALTER TABLE \`users\`
  MODIFY \`id\` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1042;

ALTER TABLE \`orders\`
  MODIFY \`id\` int(11) NOT NULL AUTO_INCREMENT;

--
-- Constraints for dumped tables
--

ALTER TABLE \`orders\`
  ADD CONSTRAINT \`orders_user_id_fk\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE;
COMMIT;
`;
