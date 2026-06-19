// Ejecuta db/schema.sql contra la base de datos usando la cadena de conexion DATABASE_URL.
// Uso:  DATABASE_URL="postgresql://..." node scripts/push-schema.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = join(__dirname, '..', '..', 'db', 'schema.sql');

const sql = readFileSync(schemaPath, 'utf8');

// Si hay DATABASE_URL la usamos; si no, tomamos los campos PG* por separado
// (evita problemas cuando la contrasena contiene caracteres como '@').
const client = process.env.DATABASE_URL
  ? new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  : new pg.Client({
      host: process.env.PGHOST,
      port: Number(process.env.PGPORT ?? 5432),
      user: process.env.PGUSER ?? 'postgres',
      password: process.env.PGPASSWORD,
      database: process.env.PGDATABASE ?? 'postgres',
      ssl: { rejectUnauthorized: false },
    });

try {
  await client.connect();
  console.log('Conectado. Ejecutando schema.sql...');
  await client.query(sql);
  console.log('OK: esquema aplicado.');

  const { rows } = await client.query(
    `select table_name from information_schema.tables
      where table_schema = 'public' order by table_name`,
  );
  console.log(`\nTablas creadas (${rows.length}):`);
  for (const r of rows) console.log('  -', r.table_name);
} catch (err) {
  console.error('ERROR aplicando el esquema:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
