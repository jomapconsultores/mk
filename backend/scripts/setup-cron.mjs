// Programa el motor de seguimiento usando pg_cron + pg_net DENTRO de Supabase.
// Cada 10 min llama a POST <BACKEND_URL>/cron/run-sequences con la cabecera del secreto.
//
// Uso (variables de entorno):
//   PGHOST, PGUSER, PGPASSWORD   -> conexion a la BD (pooler de Supabase)
//   BACKEND_URL                  -> ej. https://tu-backend.tudominio.com
//   CRON_SECRET                  -> el mismo CRON_SECRET del backend
import pg from 'pg';

const backendUrl = process.env.BACKEND_URL;
const cronSecret = process.env.CRON_SECRET;
if (!backendUrl || !cronSecret) {
  console.error('Faltan BACKEND_URL o CRON_SECRET');
  process.exit(1);
}

const c = new pg.Client({
  host: process.env.PGHOST, port: 5432, user: process.env.PGUSER,
  password: process.env.PGPASSWORD, database: 'postgres', ssl: { rejectUnauthorized: false },
});

const command = `select net.http_post(
  url := '${backendUrl}/cron/run-sequences',
  headers := jsonb_build_object('Content-Type','application/json','x-cron-secret','${cronSecret}')
);`;

try {
  await c.connect();
  await c.query('create extension if not exists pg_net;');
  await c.query('create extension if not exists pg_cron;');
  // Quitar el job anterior si existe (ignora error si no existe)
  try { await c.query("select cron.unschedule('run-sequences');"); } catch {}
  const { rows } = await c.query("select cron.schedule('run-sequences', '*/10 * * * *', $1)", [command]);
  console.log('OK: cron programado. jobid =', rows[0]?.schedule ?? JSON.stringify(rows[0]));
  const jobs = await c.query("select jobname, schedule, active from cron.job where jobname='run-sequences'");
  console.log('Job:', JSON.stringify(jobs.rows));
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(2);
} finally {
  await c.end();
}
