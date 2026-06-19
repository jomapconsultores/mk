import pg from 'pg';
const c = new pg.Client({ host: process.env.PGHOST, port:5432, user: process.env.PGUSER, password: process.env.PGPASSWORD, database:'postgres', ssl:{rejectUnauthorized:false}});
await c.connect();
const s = await c.query("select name, channel, trigger from sequences");
console.log('Secuencias:', JSON.stringify(s.rows));
const st = await c.query("select step_order, delay_hours, coalesce(left(message_template,32), '[redactado por IA]') as msg, send_condition from sequence_steps order by step_order");
console.log('Pasos del seguimiento:');
for (const r of st.rows) console.log(`  paso ${r.step_order}: espera +${r.delay_hours}h -> ${r.msg}`);
await c.end();
