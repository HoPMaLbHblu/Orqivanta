-- The application connects as a role that does NOT own the tables,
-- so PostgreSQL row-level security policies always apply to it.
CREATE ROLE orqivanta_app LOGIN PASSWORD 'orqivanta_app';
GRANT CONNECT ON DATABASE orqivanta TO orqivanta_app;
CREATE DATABASE orqivanta_test OWNER orqivanta_owner;
GRANT CONNECT ON DATABASE orqivanta_test TO orqivanta_app;
