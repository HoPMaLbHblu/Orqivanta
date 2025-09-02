// Integration tests use a separate database so they never touch development data.
process.env.DATABASE_URL ??= 'postgres://orqivanta_app:orqivanta_app@localhost:5432/orqivanta_test';
process.env.DATABASE_ADMIN_URL ??= 'postgres://orqivanta_owner:orqivanta_owner@localhost:5432/orqivanta_test';
process.env.MAIL_TRANSPORT = 'log';
process.env.STORAGE_DIR ??= '.storage-test';
