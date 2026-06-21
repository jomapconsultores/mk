'use client';

import { useState, useRef } from 'react';

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'https://marketing-map-backend.onrender.com';

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

type Tab = 'estrategia' | 'maps' | 'texto' | 'emails' | 'donacion';

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
  titulo: string;
  subtitulo: string;
  historia_emotiva: string;
  llamado_accion: string;
  mensaje_whatsapp: string;
  mensaje_email_asunto: string;
  mensaje_email_cuerpo: string;
  mensaje_instagram: string;
  metas_sugeridas: { monto: number; descripcion: string }[];
  argumento_psicologico: string;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      style={{ fontSize: 11, padding: '2px 8px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', color: 'var(--muted)' }}
    >
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-block', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 20, padding: '3px 10px', fontSize: 12, margin: '2px 3px 2px 0' }}>
      {label}
    </span>
  );
}

function MsgBox({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        <CopyBtn text={text} />
      </div>
      <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {text}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Sub-componentes por tab
// ─────────────────────────────────────────────────────────────

function TabEstrategia() {
  const [industria, setIndustria] = useState('');
  const [ubicacion, setUbicacion] = useState('Ecuador');
  const [objetivo, setObjetivo] = useState('');
  const [tamano, setTamano] = useState<'todas' | 'micro' | 'pyme' | 'empresa'>('todas');
  const [palabras, setPalabras] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchStrategy | null>(null);
  const [error, setError] = useState('');

  async function generar() {
    if (!industria.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch(`${API}/captacion/estrategia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          industria,
          ubicacion,
          tamano,
          palabras_clave: palabras.split(',').map(s => s.trim()).filter(Boolean),
          objetivo: objetivo || undefined,
        }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? 'Error desconocido');
      setResult(d.estrategia);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        La IA genera una estrategia completa de captación aplicando DISC, Cialdini y niveles de consciencia de Schwartz — con mensajes listos para usar.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Industria / nicho objetivo *</label>
          <input value={industria} onChange={e => setIndustria(e.target.value)} placeholder="ej: restaurantes, clínicas dentales, abogados…" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Ubicación</label>
          <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Ecuador" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Tamaño de empresa</label>
          <select value={tamano} onChange={e => setTamano(e.target.value as any)} style={inputStyle}>
            <option value="todas">Todas</option>
            <option value="micro">Micro (1-5 empleados)</option>
            <option value="pyme">PYME (6-50 empleados)</option>
            <option value="empresa">Empresa (50+)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Palabras clave (separadas por coma)</label>
          <input value={palabras} onChange={e => setPalabras(e.target.value)} placeholder="ej: marketing, digitalización, ventas" style={inputStyle} />
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Objetivo de la captación</label>
        <input value={objetivo} onChange={e => setObjetivo(e.target.value)} placeholder="ej: conseguir reuniones de 15 minutos para presentar Marketing MAP" style={inputStyle} />
      </div>

      <button onClick={generar} disabled={loading || !industria.trim()} style={btnStyle(loading || !industria.trim())}>
        {loading ? '⏳ Generando estrategia con IA…' : '🧠 Generar estrategia completa'}
      </button>

      {error && <div style={errorStyle}>{error}</div>}

      {result && (
        <div style={{ marginTop: 28 }}>
          <Section title="Cliente ideal">
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{result.resumen_cliente_ideal}</p>
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Section title="🗺️ Búsquedas Google Maps">
              {result.queries_google_maps.map((q, i) => <div key={i} style={queryRow}><span style={{ flex: 1, fontSize: 13 }}>{q}</span><CopyBtn text={q} /></div>)}
            </Section>
            <Section title="🔍 Búsquedas Web">
              {result.queries_web.map((q, i) => <div key={i} style={queryRow}><span style={{ flex: 1, fontSize: 13 }}>{q}</span><CopyBtn text={q} /></div>)}
            </Section>
            <Section title="📸 Hashtags Instagram">
              <div>{result.hashtags_instagram.map((h, i) => <Tag key={i} label={h} />)}</div>
              <div style={{ marginTop: 8 }}><CopyBtn text={result.hashtags_instagram.join(' ')} /></div>
            </Section>
            <Section title="👥 Grupos Facebook">
              {result.grupos_facebook.map((g, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>• {g}</div>)}
            </Section>
            <Section title="💼 Búsquedas LinkedIn">
              {result.busquedas_linkedin.map((l, i) => <div key={i} style={queryRow}><span style={{ flex: 1, fontSize: 13 }}>{l}</span><CopyBtn text={l} /></div>)}
            </Section>
            <Section title="📧 Patrones de email">
              {result.patrones_email.map((p, i) => <div key={i} style={queryRow}><span style={{ flex: 1, fontSize: 13, fontFamily: 'monospace' }}>{p}</span><CopyBtn text={p} /></div>)}
            </Section>
          </div>

          <Section title="🪝 Anzuelo principal (PAS)">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <p style={{ fontSize: 14, fontStyle: 'italic', lineHeight: 1.7, flex: 1 }}>"{result.anzuelo_principal}"</p>
              <CopyBtn text={result.anzuelo_principal} />
            </div>
          </Section>

          <Section title="❓ Objeciones más comunes">
            {result.objeciones_top3.map((o, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>• {o}</div>)}
          </Section>

          <Section title="✉️ Secuencia de mensajes">
            <MsgBox label="Mensaje de apertura (día 1)" text={result.mensaje_apertura} />
            <MsgBox label="Seguimiento 1 (día 3 – si no responde)" text={result.mensaje_seguimiento_1} />
            <MsgBox label="Seguimiento 2 (día 7 – cierre suave)" text={result.mensaje_seguimiento_2} />
          </Section>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Section title="📡 Canales recomendados">
              {result.canales_recomendados.map((c, i) => <Tag key={i} label={c} />)}
            </Section>
            <Section title="🕐 Mejor horario">
              <p style={{ fontSize: 13, lineHeight: 1.6 }}>{result.mejor_horario}</p>
            </Section>
          </div>

          {result.advertencias.length > 0 && (
            <Section title="⚠️ Consideraciones legales y éticas">
              {result.advertencias.map((a, i) => (
                <div key={i} style={{ fontSize: 13, padding: '4px 0', color: 'var(--warning, #f59e0b)' }}>• {a}</div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function TabMaps() {
  const [industria, setIndustria] = useState('');
  const [ubicacion, setUbicacion] = useState('Quito');
  const [limite, setLimite] = useState(20);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ encontrados: number; guardados: number; sourceId: string } | null>(null);
  const [error, setError] = useState('');

  async function buscar() {
    if (!industria.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch(`${API}/captacion/buscar-maps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ industria, ubicacion, limite }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? 'Error desconocido');
      setResult(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Busca negocios locales en Google Maps y los importa automáticamente como prospectos calificados con IA.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 120px', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Tipo de negocio *</label>
          <input value={industria} onChange={e => setIndustria(e.target.value)} placeholder="ej: clínicas estéticas, consultoras, gimnasios" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Ciudad / zona</label>
          <input value={ubicacion} onChange={e => setUbicacion(e.target.value)} placeholder="Quito, Guayaquil…" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Límite</label>
          <select value={limite} onChange={e => setLimite(Number(e.target.value))} style={inputStyle}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </div>
      </div>
      <button onClick={buscar} disabled={loading || !industria.trim()} style={btnStyle(loading || !industria.trim())}>
        {loading ? '⏳ Buscando en Google Maps…' : '🗺️ Buscar y capturar prospectos'}
      </button>
      {error && <div style={errorStyle}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <Stat label="Encontrados en Maps" value={result.encontrados} />
            <Stat label="Guardados como prospectos" value={result.guardados} />
          </div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 12 }}>
            Los prospectos se están calificando con IA en segundo plano. Puedes verlos en el módulo de Prospección.
          </p>
        </div>
      )}
    </div>
  );
}

function TabTexto() {
  const [texto, setTexto] = useState('');
  const [fuente, setFuente] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ prospectos: any[]; sourceId: string } | null>(null);
  const [error, setError] = useState('');

  async function analizar() {
    if (!texto.trim()) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch(`${API}/captacion/analizar-texto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto, fuente: fuente || undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? 'Error desconocido');
      setResult(d);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const ejemplos = [
    'LinkedIn: Perfil de empresa',
    'Directorio de cámara de comercio',
    'Página web con contactos',
    'Lista de asistentes a evento',
    'Otro',
  ];

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Pega cualquier texto con contactos (perfiles de LinkedIn, directorios, páginas web) y la IA extrae automáticamente todos los prospectos y los califica.
      </p>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle}>Fuente del texto</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {ejemplos.map(e => (
            <button key={e} onClick={() => setFuente(e)} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, border: '1px solid var(--border)', background: fuente === e ? 'var(--accent, #4f46e5)' : 'var(--panel-2)', color: fuente === e ? '#fff' : 'var(--text)', cursor: 'pointer' }}>
              {e}
            </button>
          ))}
        </div>
        <input value={fuente} onChange={e => setFuente(e.target.value)} placeholder="o escribe la fuente aquí" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>Texto con contactos *</label>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder="Pega aquí el texto copiado de LinkedIn, un directorio web, una lista de empresas, etc."
          rows={10}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{texto.length.toLocaleString()} caracteres</div>
      </div>
      <button onClick={analizar} disabled={loading || texto.trim().length < 30} style={btnStyle(loading || texto.trim().length < 30)}>
        {loading ? '⏳ Extrayendo prospectos con IA…' : '🔬 Analizar y extraer prospectos'}
      </button>
      {error && <div style={errorStyle}>{error}</div>}
      {result && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 32, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <Stat label="Prospectos extraídos" value={result.prospectos.length} />
            <Stat label="Guardados en DB" value={result.prospectos.filter((p: any) => p.full_name || p.company || p.email).length} />
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  {['Nombre', 'Empresa', 'Email', 'Teléfono', 'Sector', 'Fit'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--muted)', fontWeight: 600, fontSize: 11, textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.prospectos.map((p: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={tdStyle}>{p.full_name ?? '—'}</td>
                    <td style={tdStyle}>{p.company ?? '—'}</td>
                    <td style={tdStyle}>{p.email ?? '—'}</td>
                    <td style={tdStyle}>{p.phone ?? '—'}</td>
                    <td style={tdStyle}>{p.industry ?? '—'}</td>
                    <td style={tdStyle}>
                      {p.fit_score != null ? (
                        <span style={{ background: fitColor(p.fit_score), color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                          {p.fit_score}
                        </span>
                      ) : '—'}
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
      const r = await fetch(`${API}/captacion/emails-empresa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empresa, dominio: dominio || undefined }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? 'Error desconocido');
      setPatrones(d.patrones);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function generarEjemplo(patron: string, nombre = 'carlos', apellido = 'gomez') {
    return patron
      .replace('{n}', nombre)
      .replace('{a}', apellido)
      .replace('{nombre}', nombre)
      .replace('{apellido}', apellido);
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Identifica los patrones de email corporativo que probablemente usa una empresa. Úsalos para construir listas de contacto cuando conoces el nombre de la persona pero no su email.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={labelStyle}>Nombre de empresa *</label>
          <input value={empresa} onChange={e => setEmpresa(e.target.value)} placeholder="ej: Corporación Favorita" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Dominio web (opcional)</label>
          <input value={dominio} onChange={e => setDominio(e.target.value)} placeholder="ej: corporacionfavorita.com" style={inputStyle} />
        </div>
      </div>
      <button onClick={descubrir} disabled={loading || !empresa.trim()} style={btnStyle(loading || !empresa.trim())}>
        {loading ? '⏳ Descubriendo patrones…' : '📧 Descubrir patrones de email'}
      </button>
      {error && <div style={errorStyle}>{error}</div>}
      {patrones.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <Section title="Patrones descubiertos">
            {patrones.map((p, i) => (
              <div key={i} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <code style={{ flex: 1, fontSize: 13 }}>{p}</code>
                <span style={{ color: 'var(--muted)', fontSize: 12 }}>→ {generarEjemplo(p)}</span>
                <CopyBtn text={p} />
              </div>
            ))}
          </Section>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
            <strong>Leyenda:</strong> {'{n}'} = nombre, {'{a}'} = apellido. Usa estas plantillas para construir emails específicos.
          </p>
        </div>
      )}
    </div>
  );
}

function TabDonacion() {
  const [causa, setCausa] = useState('');
  const [organizacion, setOrganizacion] = useState('');
  const [meta, setMeta] = useState('');
  const [publico, setPublico] = useState('');
  const [loading, setLoading] = useState(false);
  const [campana, setCampana] = useState<DonationCampaign | null>(null);
  const [error, setError] = useState('');

  async function generar() {
    if (!causa.trim()) return;
    setLoading(true); setError(''); setCampana(null);
    try {
      const r = await fetch(`${API}/captacion/donacion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          causa,
          organizacion: organizacion || undefined,
          meta_monto: meta ? Number(meta) : undefined,
          publico_objetivo: publico || undefined,
        }),
      });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? 'Error desconocido');
      setCampana(d.campana);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>
        Genera una campaña de recaudación de fondos con storytelling emocional, mensajes listos para WhatsApp, email e Instagram, y metas de donación con impacto concreto.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={labelStyle}>Causa o proyecto *</label>
          <input value={causa} onChange={e => setCausa(e.target.value)} placeholder="ej: becas para niños de escasos recursos en Quito" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Organización</label>
          <input value={organizacion} onChange={e => setOrganizacion(e.target.value)} placeholder="ej: Fundación Amanecer" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Meta de recaudación ($)</label>
          <input value={meta} onChange={e => setMeta(e.target.value)} type="number" placeholder="ej: 5000" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Público objetivo</label>
          <input value={publico} onChange={e => setPublico(e.target.value)} placeholder="ej: empresarios y profesionales quiteños" style={inputStyle} />
        </div>
      </div>
      <button onClick={generar} disabled={loading || !causa.trim()} style={btnStyle(loading || !causa.trim())}>
        {loading ? '⏳ Generando campaña con IA…' : '❤️ Generar campaña de donaciones'}
      </button>
      {error && <div style={errorStyle}>{error}</div>}
      {campana && (
        <div style={{ marginTop: 28 }}>
          <Section title="🎯 Campaña generada">
            <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent, #4f46e5)', marginBottom: 4 }}>{campana.titulo}</h2>
              <p style={{ fontSize: 15, color: 'var(--muted)' }}>{campana.subtitulo}</p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <CopyBtn text={`${campana.titulo}\n${campana.subtitulo}\n\n${campana.historia_emotiva}\n\n${campana.llamado_accion}`} />
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.8, fontStyle: 'italic', color: 'var(--muted)' }}>{campana.historia_emotiva}</p>
            <div style={{ marginTop: 12, background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.2)', borderRadius: 8, padding: 12 }}>
              <strong style={{ fontSize: 14 }}>CTA:</strong> {campana.llamado_accion}
            </div>
          </Section>

          <Section title="💰 Metas de donación sugeridas">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              {campana.metas_sugeridas.map((m, i) => (
                <div key={i} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--accent, #4f46e5)' }}>${m.monto}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{m.descripcion}</div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="📱 Mensajes listos para compartir">
            <MsgBox label="WhatsApp (160 chars)" text={campana.mensaje_whatsapp} />
            <MsgBox label="Asunto del email" text={campana.mensaje_email_asunto} />
            <MsgBox label="Cuerpo del email" text={campana.mensaje_email_cuerpo} />
            <MsgBox label="Caption Instagram" text={campana.mensaje_instagram} />
          </Section>

          <Section title="🧠 Por qué funciona psicológicamente">
            <p style={{ fontSize: 13, lineHeight: 1.7 }}>{campana.argumento_psicologico}</p>
          </Section>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Componentes auxiliares
// ─────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text)' }}>{title}</h3>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 800 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

function fitColor(score: number) {
  if (score >= 75) return '#16a34a';
  if (score >= 50) return '#d97706';
  return '#dc2626';
}

// ─────────────────────────────────────────────────────────────
// Estilos compartidos
// ─────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--muted)',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  background: 'var(--panel-2)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
  boxSizing: 'border-box',
};

const btnStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '10px 20px',
  background: disabled ? 'var(--panel-2)' : 'var(--accent, #4f46e5)',
  color: disabled ? 'var(--muted)' : '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : 1,
});

const errorStyle: React.CSSProperties = {
  marginTop: 12,
  padding: '10px 14px',
  background: 'rgba(220,38,38,0.1)',
  border: '1px solid rgba(220,38,38,0.3)',
  borderRadius: 8,
  color: '#ef4444',
  fontSize: 13,
};

const queryRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '5px 0',
  borderBottom: '1px solid var(--border)',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
  verticalAlign: 'middle',
};

// ─────────────────────────────────────────────────────────────
// Página principal
// ─────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; desc: string }[] = [
  { id: 'estrategia', label: '🧠 Estrategia IA',     desc: 'DISC + Cialdini + Schwartz' },
  { id: 'maps',       label: '🗺️ Google Maps',       desc: 'Negocios locales' },
  { id: 'texto',      label: '📋 Analizar texto',     desc: 'LinkedIn, directorios' },
  { id: 'emails',     label: '📧 Patrones email',     desc: 'Discovery empresarial' },
  { id: 'donacion',   label: '❤️ Campaña donación',  desc: 'Recaudación de fondos' },
];

export default function CaptacionPage() {
  const [activeTab, setActiveTab] = useState<Tab>('estrategia');

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Captación Activa</h1>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>
          Motor de búsqueda inteligente y no invasiva de nuevos clientes — psicología aplicada, multicanal, con IA.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            style={{
              padding: '10px 16px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: activeTab === t.id ? 'var(--accent, #4f46e5)' : 'var(--panel)',
              color: activeTab === t.id ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 13 }}>{t.label}</div>
            <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{t.desc}</div>
          </button>
        ))}
      </div>

      {/* Panel activo */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 14, padding: 24 }}>
        {activeTab === 'estrategia' && <TabEstrategia />}
        {activeTab === 'maps'       && <TabMaps />}
        {activeTab === 'texto'      && <TabTexto />}
        {activeTab === 'emails'     && <TabEmails />}
        {activeTab === 'donacion'   && <TabDonacion />}
      </div>
    </div>
  );
}
