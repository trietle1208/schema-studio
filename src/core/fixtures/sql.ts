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
