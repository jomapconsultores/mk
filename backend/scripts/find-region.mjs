// Sondea los poolers de Supabase por region para encontrar donde vive el proyecto.
import pg from 'pg';

const ref = 'pamplfrwwawfgvbzbndk';
const password = process.env.PGPASSWORD;
const regions = [
  'us-east-2', 'us-west-1', 'sa-east-1', 'ca-central-1',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'ap-southeast-1', 'ap-southeast-2', 'ap-south-1', 'ap-northeast-1',
];
const prefixes = ['aws-0', 'aws-1'];

for (const prefix of prefixes) {
  for (const region of regions) {
    const host = `${prefix}-${region}.pooler.supabase.com`;
    const client = new pg.Client({
      host, port: 5432, user: `postgres.${ref}`, password,
      database: 'postgres', ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    });
    try {
      await client.connect();
      console.log(`>>> ENCONTRADO: ${host}  (region=${region}, prefix=${prefix})`);
      await client.end();
      process.exit(0);
    } catch (err) {
      const m = err.message || String(err);
      if (/tenant\/user .* not found/i.test(m)) {
        // region equivocada, seguir
      } else if (/password|authentication/i.test(m)) {
        console.log(`>>> HOST CORRECTO pero password mal: ${host} -> ${m}`);
        process.exit(2);
      } else {
        // ENOTFOUND del host (region inexistente) u otro: ignorar silenciosamente
      }
      try { await client.end(); } catch {}
    }
  }
}
console.log('No se encontro la region con estas combinaciones.');
process.exit(1);
