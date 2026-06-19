import { readFileSync } from 'node:fs';
import pg from 'pg';
const file = process.argv[2];
const sql = readFileSync(file, 'utf8');
const client = new pg.Client({
  host: process.env.PGHOST, port: 5432, user: process.env.PGUSER,
  password: process.env.PGPASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(sql);
console.log('OK:', file);
// Verificar RLS y la funcion de baja
const rls = await client.query(`select tablename, rowsecurity from pg_tables where schemaname='public' order by tablename`);
console.log('\nRLS por tabla:');
for (const r of rls.rows) console.log(`  ${r.rowsecurity ? 'ON ' : 'OFF'}  ${r.tablename}`);
const fn = await client.query(`select proname from pg_proc where proname='opt_out_contact'`);
console.log('\nFuncion opt_out_contact:', fn.rowCount ? 'EXISTE' : 'FALTA');
const tags = await client.query('select count(*)::int as n from tags');
console.log('Tags semilla:', tags.rows[0].n);
await client.end();
