'use client';

import { useState, useRef, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://marketing-map-backend.onrender.com';

// ─────────────────────────────────────────────────────────────
// Ciudades en orden progresivo (Cuenca primero — base del cliente)
// ─────────────────────────────────────────────────────────────

const CIUDADES = [
  { nombre: 'Cuenca',        region: 'Azuay',          ico: '🏔️' },
  { nombre: 'Guayaquil',     region: 'Guayas',         ico: '🌊' },
  { nombre: 'Quito',         region: 'Pichincha',      ico: '🏛️' },
  { nombre: 'Ambato',        region: 'Tungurahua',     ico: '🌸' },
  { nombre: 'Loja',          region: 'Loja',           ico: '🌿' },
  { nombre: 'Manta',         region: 'Manabí',         ico: '⚓' },
  { nombre: 'Riobamba',      region: 'Chimborazo',     ico: '🗻' },
  { nombre: 'Machala',       region: 'El Oro',         ico: '🍌' },
  { nombre: 'Ibarra',        region: 'Imbabura',       ico: '🌺' },
  { nombre: 'Santo Domingo', region: 'Santo Domingo',  ico: '🌴' },
];

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

interface MercadoInferido {
  cliente_ideal: string;
  industrias: string[];
  queries_maps: string[];
  query_maps_principal: string;
  por_que_lo_necesitan: string;
}

interface ResultadoCiudad {
  ciudad: string;
  region: string;
  ico: string;
  encontrados: number;
  guardados: number;
  sourceId: string;
  estado: 'buscando' | 'listo' | 'error';
  error?: string;
}

type EstadoBusqueda = 'idle' | 'inferiendo' | 'buscando' | 'listo' | 'error';

// ─────────────────────────────────────────────────────────────
// Herramientas avanzadas (tabs secundarios)
// ─────────────────────────────────────────────────────────────

interface SearchStrategy {
  resumen_cliente_ideal: string;
  queries_google_maps: string[];
  queries_web: string[];
  hashtags_instagram: string[];
  grupos_facebook: string[];
  busquedas_linkedin: string[];
  patrones_email: string[];
  anzuelo_principal: string;
  objeciones_top3: string[];
  mensaje_apertura: string;
  mensaje_seguimiento_1: string;
  mensaje_seguimiento_2: string;
  canales_recomendados: string[];
  mejor_horario: string;
  advertencias: string[];
}

interface DonationCampaign {
  titulo: string; subtitulo: string; historia_emotiva: string; llamado_accion: string;
  mensaje_whatsapp: string; mensaje_email_asunto: string; mensaje_email_cuerpo: string;
  mensaje_instagram: string; metas_sugeridas: { monto: number; descripcion: string }[];
  argumento_psicologico: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers visuales
// ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ fontSize: 11, padding: '2px 8px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--muted)', flexShrink: 0 }}>
      {copied ? '✓' : 'Copiar'}
    </button>
  );
}

function Tag({ label }: { label: string }) {
  return <span style={{ display: 'inline-block', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: 12, margin: '2px 3px 2px 0' }}>{label}</span>;
}

function MsgBox({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <CopyBtn text={text} />
      </div>
      <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{text}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 14 }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{title}</h3>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', fontSize: 13, boxSizing: 'border-box' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };

// ─────────────────────────────────────────────────────────────
// Sección principal: Buscar mercado
// ─────────────────────────────────────────────────────────────

function BuscarMercado() {
  const [producto, setProducto] = useState('');
  const [estado, setEstado] = useState<EstadoBusqueda>('idle');
  const [mercado, setMercado] = useState<MercadoInferido | null>(null);
  const [resultados, setResultados] = useState<ResultadoCiudad[]>([]);
  const [indiceActual, setIndiceActual] = useState(0);
  const [totalGuardados, setTotalGuardados] = useState(0);
  const [error, setError] = useState('');
  const abortRef = useRef(false);
  const queryMapsRef = useRef('');

  const totalEncontrados = resultados.reduce((s, r) => s + r.encontrados, 0);
  const listo = estado === 'listo';
  const enProceso = estado === 'inferiendo' || estado === 'buscando';

  const buscarCiudad = useCallback(async (
    idx: number,
    prod: string,
    queriesMaps: string[],
    acumGuardados: number,
  ) => {
    if (abortRef.current || idx >= CIUDADES.length) {
      setEstado('listo');
      return;
    }

    const ciudad = CIUDADES[idx];
    setIndiceActual(idx);

    setResultados(prev => {
      const next = [...prev];
      next[idx] = { ...ciudad, ciudad: ciudad.nombre, encontrados: 0, guardados: 0, sourceId: '', estado: 'buscando' };
      return next;
    });

    try {
      const res = await fetch(`${API}/captacion/buscar-mercado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          producto: prod,
          ciudad: ciudad.nombre,
          queries_maps: queriesMaps,
          limite: 20,
        }),
      });
      const d = await res.json();

      if (!d.ok) throw new Error(d.error ?? 'Error');

      const nuevosGuardados = acumGuardados + (d.guardados ?? 0);
      setTotalGuardados(nuevosGuardados);

      setResultados(prev => {
        const next = [...prev];
        next[idx] = { ...ciudad, ciudad: ciudad.nombre, encontrados: d.encontrados ?? 0, guardados: d.guardados ?? 0, sourceId: d.sourceId ?? '', estado: 'listo' };
        return next;
      });

      await new Promise(r => setTimeout(r, 1500));
      buscarCiudad(idx + 1, prod, queriesMaps, nuevosGuardados);

    } catch (e: any) {
      setResultados(prev => {
        const next = [...prev];
        next[idx] = { ...ciudad, ciudad: ciudad.nombre, encontrados: 0, guardados: 0, sourceId: '', estado: 'error', error: e.message };
        return next;
      });
      await new Promise(r => setTimeout(r, 1000));
      buscarCiudad(idx + 1, prod, queriesMaps, acumGuardados);
    }
  }, []);

  async function iniciarBusqueda() {
    if (!producto.trim() || enProceso) return;
    abortRef.current = false;
    setEstado('inferiendo');
    setError('');
    setResultados([]);
    setTotalGuardados(0);
    setMercado(null);

    try {
      // Paso 1: IA infiere el mercado objetivo
      const res = await fetch(`${API}/captacion/buscar-mercado`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto: producto.trim(), ciudad: 'Cuenca', inferir: true, limite: 15 }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error ?? 'Error');

      const m: MercadoInferido = d.mercado;
      setMercado(m);
      queryMapsRef.current = m.query_maps_principal;

      setResultados([{ ...CIUDADES[0], ciudad: CIUDADES[0].nombre, encontrados: d.encontrados ?? 0, guardados: d.guardados ?? 0, sourceId: d.sourceId ?? '', estado: 'listo' }]);
      setTotalGuardados(d.guardados ?? 0);
      setEstado('buscando');

      await new Promise(r => setTimeout(r, 1500));
      buscarCiudad(1, producto.trim(), m.queries_maps ?? [m.query_maps_principal], d.guardados ?? 0);

    } catch (e: any) {
      setEstado('error');
      setError(e.message);
    }
  }

  function detener() {
    abortRef.current = true;
    setEstado('listo');
  }

  const progreso = CIUDADES.length > 0 ? Math.round((resultados.filter(r => r.estado !== 'buscando').length / CIUDADES.length) * 100) : 0;

  return (
    <div>
      {/* Buscador principal */}
      <div style={{ background: 'linear-gradient(135deg, rgba(79,70,229,0.08) 0%, rgba(129,140,248,0.04) 100%)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 16, padding: 28, marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>¿Qué producto o servicio quieres promocionar?</h2>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
          La IA identifica automáticamente tu mercado objetivo y busca clientes potenciales en Ecuador — comenzando por Cuenca y expandiéndose de manera creciente.
        </p>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={producto}
            onChange={e => setProducto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && iniciarBusqueda()}
            placeholder="Ej: Software de gestión tributaria, Clases de inglés, Servicio de contabilidad…"
            disabled={enProceso}
            style={{ ...inp, fontSize: 15, padding: '12px 16px', flex: 1 }}
          />
          {enProceso ? (
            <button onClick={detener} style={{ padding: '12px 20px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              ⏹ Detener
            </button>
          ) : (
            <button onClick={iniciarBusqueda} disabled={!producto.trim()} style={{ padding: '12px 24px', background: producto.trim() ? 'var(--accent,#4f46e5)' : 'var(--panel-2)', color: producto.trim() ? '#fff' : 'var(--muted)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: producto.trim() ? 'pointer' : 'not-allowed', whiteSpace: 'nowrap', fontSize: 14 }}>
              🔍 Buscar mercado
            </button>
          )}
        </div>

        {/* Aviso LOPDP */}
        <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 13 }}>🛡️</span>
          <span>
            <strong>Privacidad y LOPDP:</strong> Solo recopilamos datos comerciales públicos (nombre del negocio, teléfono empresarial, sitio web) desde listados de Google Maps. No se recopilan datos personales sensibles. Base legal: interés legítimo comercial (LOPDP Art. 23). Cualquier negocio puede solicitar su exclusión.
          </span>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Mercado inferido */}
      {mercado && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 240 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Cliente ideal identificado</div>
              <p style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 8 }}>{mercado.cliente_ideal}</p>
              <p style={{ fontSize: 12, color: '#10b981', fontStyle: 'italic' }}>💡 {mercado.por_que_lo_necesitan}</p>
            </div>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 4 }}>Sectores objetivo</div>
              {mercado.industrias.map((ind, i) => <Tag key={i} label={ind} />)}
            </div>
          </div>
        </div>
      )}

      {/* Progreso y resultados por ciudad */}
      {(resultados.length > 0 || estado === 'inferiendo') && (
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2 }}>
                {estado === 'inferiendo' ? '🧠 Analizando tu mercado…' :
                 estado === 'buscando'   ? `🔍 Buscando en Ecuador… (${resultados.filter(r => r.estado === 'listo').length}/${CIUDADES.length} ciudades)` :
                 `✅ Búsqueda completada — ${CIUDADES.length} ciudades de Ecuador`}
              </h3>
              {listo && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Los prospectos ya están en el módulo Prospección · Importar</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--accent,#4f46e5)' }}>{totalGuardados}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>prospectos guardados</div>
            </div>
          </div>

          {/* Barra de progreso */}
          {estado === 'buscando' && (
            <div style={{ height: 4, background: 'var(--panel-2)', borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progreso}%`, background: 'var(--accent,#4f46e5)', borderRadius: 2, transition: 'width 0.5s ease' }} />
            </div>
          )}

          {/* Grid de ciudades */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {/* Ciudades pendientes (aún no empezadas) */}
            {CIUDADES.map((c, i) => {
              const r = resultados[i];
              if (!r) {
                return (
                  <div key={c.nombre} style={{ padding: '10px 14px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, opacity: 0.4 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{c.ico} {c.nombre}</div>
                    <div style={{ fontSize: 10, color: 'var(--muted)' }}>{c.region}</div>
                    <div style={{ fontSize: 11, marginTop: 4, color: 'var(--muted)' }}>Pendiente</div>
                  </div>
                );
              }
              return (
                <div key={c.nombre} style={{
                  padding: '10px 14px',
                  background: r.estado === 'listo' && r.guardados > 0 ? 'rgba(34,197,94,0.06)' : 'var(--panel-2)',
                  border: `1px solid ${r.estado === 'buscando' ? 'var(--accent,#4f46e5)' : r.estado === 'error' ? 'rgba(220,38,38,0.3)' : r.guardados > 0 ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
                  borderRadius: 10,
                  transition: 'all 0.3s',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.ico} {c.nombre}</span>
                    {r.estado === 'buscando' && <span style={{ fontSize: 10, animation: 'pulse 1s infinite' }}>⏳</span>}
                    {r.estado === 'listo'    && r.guardados > 0 && <span style={{ fontSize: 10, color: '#22c55e' }}>✓</span>}
                    {r.estado === 'error'    && <span style={{ fontSize: 10, color: '#ef4444' }}>✗</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}>{c.region}</div>
                  {r.estado === 'buscando' ? (
                    <div style={{ fontSize: 11, color: 'var(--accent,#4f46e5)' }}>Buscando…</div>
                  ) : r.estado === 'error' ? (
                    <div style={{ fontSize: 10, color: '#ef4444' }}>{r.error ?? 'Error'}</div>
                  ) : (
                    <div style={{ display: 'flex', gap: 12 }}>
                      <div><span style={{ fontSize: 18, fontWeight: 700 }}>{r.guardados}</span><div style={{ fontSize: 9, color: 'var(--muted)' }}>guardados</div></div>
                      <div><span style={{ fontSize: 14, fontWeight: 600, color: 'var(--muted)' }}>{r.encontrados}</span><div style={{ fontSize: 9, color: 'var(--muted)' }}>encontrados</div></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {listo && totalGuardados > 0 && (
            <div style={{ marginTop: 16, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <a href="/prospeccion?tab=pipeline" style={{ padding: '10px 20px', background: 'var(--accent,#4f46e5)', color: '#fff', borderRadius: 8, fontWeight: 600, fontSize: 13, textDecoration: 'none' }}>
                👁 Ver {totalGuardados} prospectos en Pipeline →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Herramientas avanzadas (tabs colapsables)
// ─────────────────────────────────────────────────────────────

type Tab = 'estrategia' | 'texto' | 'emails' | 'donacion';

function HerramientasAvanzadas() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('estrategia');

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: 14, fontWeight: 600 }}
      >
        <span>⚙️ Herramientas avanzadas</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{open ? '▲ Ocultar' : '▼ Estrategia IA · Analizar texto · Patrones email · Donaciones'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 20px 20px' }}>
          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
            {([
              { id: 'estrategia', label: '🧠 Estrategia DISC' },
              { id: 'texto',      label: '📋 Analizar texto' },
              { id: 'emails',     label: '📧 Patrones email' },
              { id: 'donacion',   label: '❤️ Campaña donación' },
            ] as { id: Tab; label: string }[]).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 14px', fontSize: 12, fontWeight: 600, background: 'none', border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--accent,#4f46e5)' : '2px solid transparent',
                color: tab === t.id ? 'var(--accent,#4f46e5)' : 'var(--muted)', cursor: 'pointer',
              }}>{t.label}</button>
            ))}
          </div>

          {tab === 'estrategia' && <TabEstrategia />}
          {tab === 'texto'      && <TabTexto />}
          {tab === 'emails'     && <TabEmails />}
          {tab === 'donacion'   && <TabDonacion />}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Estrategia DISC + Cialdini
// ─────────────────────────────────────────────────────────────

function TabEstrategia() {
  const [industria, setIndustria] = useState('');
  const [ubicacion, setUbicacion] = useState('Ecuador');
  const [objetivo, setObjetivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchStrategy | null>(null);
  const [error, setError] = useState('');

  async function generar() {
    if (!industria.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch(`${API}/captacion/estrategia`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ industria, ubicacion, objetivo: objetivo || undefined }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setResult(d.estrategia);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl}>Industria / nicho *</label><input value={industria} onChange={e => setIndustria(e.target.value)} placeholder="ej: clínicas dentales, abogados…" style={inp} /></div>
        <div><label style={lbl}>Ubicación</label><input value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Ecuador" style={inp} /></div>
      </div>
      <div style={{ marginBottom: 12 }}><label style={lbl}>Objetivo</label><input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="ej: conseguir reuniones de 15 minutos" style={inp} /></div>
      <button onClick={generar} disabled={loading || !industria.trim()} style={{ padding: '9px 18px', background: loading || !industria.trim() ? 'var(--panel-2)' : 'var(--accent,#4f46e5)', color: loading || !industria.trim() ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: loading || !industria.trim() ? 'not-allowed' : 'pointer' }}>
        {loading ? '⏳ Generando…' : '🧠 Generar estrategia DISC + Cialdini'}
      </button>
      {error && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <Section title="🪝 Anzuelo principal (PAS)">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <p style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1.7, flex: 1 }}>"{result.anzuelo_principal}"</p>
              <CopyBtn text={result.anzuelo_principal} />
            </div>
          </Section>
          <Section title="✉️ Secuencia de mensajes">
            <MsgBox label="Apertura (día 1)" text={result.mensaje_apertura} />
            <MsgBox label="Seguimiento 1 (día 3)" text={result.mensaje_seguimiento_1} />
            <MsgBox label="Seguimiento 2 (día 7 – cierre suave)" text={result.mensaje_seguimiento_2} />
          </Section>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Section title="📸 Instagram">
              <div>{result.hashtags_instagram.map((h, i) => <Tag key={i} label={h} />)}</div>
            </Section>
            <Section title="💼 LinkedIn">
              {result.busquedas_linkedin.map((l, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ flex: 1 }}>{l}</span><CopyBtn text={l} /></div>)}
            </Section>
          </div>
          <Section title="❓ Objeciones top 3">
            {result.objeciones_top3.map((o, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>• {o}</div>)}
          </Section>
          {result.advertencias.length > 0 && (
            <Section title="⚠️ Consideraciones LOPDP">
              {result.advertencias.map((a, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', color: '#f59e0b' }}>• {a}</div>)}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Analizar texto
// ─────────────────────────────────────────────────────────────

function TabTexto() {
  const [texto, setTexto] = useState('');
  const [fuente, setFuente] = useState('LinkedIn');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ prospectos: any[] } | null>(null);
  const [error, setError] = useState('');

  async function analizar() {
    if (texto.trim().length < 30) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch(`${API}/captacion/analizar-texto`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto, fuente }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setResult(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
        Pega cualquier texto con contactos (LinkedIn, directorios, páginas web) y la IA extrae y califica todos los prospectos automáticamente.
      </p>
      <div style={{ marginBottom: 10 }}><label style={lbl}>Fuente</label><input value={fuente} onChange={e => setFuente(e.target.value)} placeholder="LinkedIn, directorio, evento…" style={inp} /></div>
      <div style={{ marginBottom: 12 }}><label style={lbl}>Texto *</label><textarea value={texto} onChange={e => setTexto(e.target.value)} rows={8} placeholder="Pega aquí el texto copiado…" style={{ ...inp, resize: 'vertical', fontFamily: 'inherit' }} /></div>
      <button onClick={analizar} disabled={loading || texto.trim().length < 30} style={{ padding: '9px 18px', background: loading || texto.trim().length < 30 ? 'var(--panel-2)' : 'var(--accent,#4f46e5)', color: loading || texto.trim().length < 30 ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
        {loading ? '⏳ Analizando…' : '🔬 Extraer prospectos'}
      </button>
      {error && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>{error}</div>}
      {result && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, color: '#22c55e', marginBottom: 10 }}>✅ {result.prospectos.length} prospectos extraídos y guardados en el pipeline</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ borderBottom: '1px solid var(--border)' }}>{['Nombre', 'Empresa', 'Email', 'Teléfono', 'Fit'].map(h => <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600 }}>{h}</th>)}</tr></thead>
              <tbody>
                {result.prospectos.map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '6px 10px' }}>{p.full_name ?? '—'}</td>
                    <td style={{ padding: '6px 10px' }}>{p.company ?? '—'}</td>
                    <td style={{ padding: '6px 10px' }}>{p.email ?? '—'}</td>
                    <td style={{ padding: '6px 10px' }}>{p.phone ?? '—'}</td>
                    <td style={{ padding: '6px 10px' }}>
                      {p.fit_score != null ? <span style={{ background: p.fit_score >= 75 ? '#16a34a' : p.fit_score >= 50 ? '#d97706' : '#dc2626', color: '#fff', padding: '2px 7px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{p.fit_score}</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Patrones de email
// ─────────────────────────────────────────────────────────────

function TabEmails() {
  const [empresa, setEmpresa] = useState('');
  const [dominio, setDominio] = useState('');
  const [loading, setLoading] = useState(false);
  const [patrones, setPatrones] = useState<string[]>([]);
  const [error, setError] = useState('');

  async function descubrir() {
    if (!empresa.trim()) return;
    setLoading(true); setError(''); setPatrones([]);
    try {
      const r = await fetch(`${API}/captacion/emails-empresa`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ empresa, dominio: dominio || undefined }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setPatrones(d.patrones);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  function ejemplo(p: string) { return p.replace('{n}', 'carlos').replace('{a}', 'gomez').replace('{nombre}', 'carlos').replace('{apellido}', 'gomez'); }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl}>Empresa *</label><input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="ej: Corporación Favorita" style={inp} /></div>
        <div><label style={lbl}>Dominio (opcional)</label><input value={dominio} onChange={e => setDominio(e.target.value)} placeholder="ej: corporacionfavorita.com" style={inp} /></div>
      </div>
      <button onClick={descubrir} disabled={loading || !empresa.trim()} style={{ padding: '9px 18px', background: loading || !empresa.trim() ? 'var(--panel-2)' : 'var(--accent,#4f46e5)', color: loading || !empresa.trim() ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
        {loading ? '⏳ Descubriendo…' : '📧 Descubrir patrones'}
      </button>
      {error && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>{error}</div>}
      {patrones.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {patrones.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 6 }}>
              <code style={{ flex: 1, fontSize: 13 }}>{p}</code>
              <span style={{ color: 'var(--muted)', fontSize: 11 }}>→ {ejemplo(p)}</span>
              <CopyBtn text={p} />
            </div>
          ))}
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}><strong>{'{n}'}</strong> = nombre · <strong>{'{a}'}</strong> = apellido</p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab: Campaña de donaciones
// ─────────────────────────────────────────────────────────────

function TabDonacion() {
  const [causa, setCausa] = useState('');
  const [organizacion, setOrganizacion] = useState('');
  const [meta, setMeta] = useState('');
  const [loading, setLoading] = useState(false);
  const [campana, setCampana] = useState<DonationCampaign | null>(null);
  const [error, setError] = useState('');

  async function generar() {
    if (!causa.trim()) return;
    setLoading(true); setError(''); setCampana(null);
    try {
      const r = await fetch(`${API}/captacion/donacion`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ causa, organizacion: organizacion || undefined, meta_monto: meta ? Number(meta) : undefined }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error);
      setCampana(d.campana);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div><label style={lbl}>Causa *</label><input value={causa} onChange={e => setCausa(e.target.value)} placeholder="ej: becas para niños de Cuenca" style={inp} /></div>
        <div><label style={lbl}>Organización</label><input value={organizacion} onChange={e => setOrganizacion(e.target.value)} placeholder="Fundación Pensamiento Libre" style={inp} /></div>
        <div><label style={lbl}>Meta ($)</label><input value={meta} type="number" onChange={e => setMeta(e.target.value)} placeholder="ej: 5000" style={inp} /></div>
      </div>
      <button onClick={generar} disabled={loading || !causa.trim()} style={{ padding: '9px 18px', background: loading || !causa.trim() ? 'var(--panel-2)' : '#dc2626', color: loading || !causa.trim() ? 'var(--muted)' : '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer' }}>
        {loading ? '⏳ Generando campaña…' : '❤️ Generar campaña de donaciones'}
      </button>
      {error && <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>{error}</div>}
      {campana && (
        <div style={{ marginTop: 16 }}>
          <div style={{ textAlign: 'center', padding: '16px 0 12px', borderBottom: '1px solid var(--border)', marginBottom: 14 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent,#4f46e5)', marginBottom: 2 }}>{campana.titulo}</h2>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>{campana.subtitulo}</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 14 }}>
            {campana.metas_sugeridas.map((m, i) => (
              <div key={i} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent,#4f46e5)' }}>${m.monto}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.descripcion}</div>
              </div>
            ))}
          </div>
          <MsgBox label="WhatsApp" text={campana.mensaje_whatsapp} />
          <MsgBox label="Asunto email" text={campana.mensaje_email_asunto} />
          <MsgBox label="Cuerpo email" text={campana.mensaje_email_cuerpo} />
          <MsgBox label="Instagram" text={campana.mensaje_instagram} />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────

export default function CaptacionPage() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>Captación Activa</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          Escribe tu producto → la IA identifica el mercado → busca clientes en Ecuador de forma inteligente, no invasiva y respetando la LOPDP.
        </p>
      </div>

      <BuscarMercado />

      <div style={{ marginTop: 24 }}>
        <HerramientasAvanzadas />
      </div>
    </div>
  );
}
