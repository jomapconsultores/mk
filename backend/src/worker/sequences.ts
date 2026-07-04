import { runEngineOnce } from '../sequences/engine.js';

// Cada cuanto revisar (por defecto cada 5 minutos). Puede correr como proceso
// en segundo plano, o como un cron job que ejecute `runEngineOnce`.
const INTERVAL_MS = Number(process.env.SEQUENCE_INTERVAL_MS ?? 5 * 60 * 1000);
const RUN_ONCE = process.argv.includes('--once');

async function tick() {
  const start = Date.now();
  try {
    const { enrolled, sent } = await runEngineOnce();
    console.log(`[worker] inscritos=${enrolled} enviados=${sent} (${Date.now() - start}ms)`);
  } catch (err) {
    console.error('[worker] error en la pasada:', err);
  }
}

async function main() {
  console.log(`[worker] motor de seguimiento iniciado. once=${RUN_ONCE} intervalo=${INTERVAL_MS}ms`);
  await tick();
  if (RUN_ONCE) return;
  setInterval(tick, INTERVAL_MS);
}

main();
