'use client';

import { useState, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';

interface Step {
  id: string;
  phase: string;
  label: string;
  detail: string;
  href: string;
  icon: string;
}

const STEPS: Step[] = [
  // ── Configuración ─────────────────────────────────────────────────────────
  { id: 'products',         phase: 'Configuración',           label: 'Agregar productos o servicios',    detail: 'Define qué vendes para que la IA personalice mensajes, calificaciones y campañas.',          href: '/products',    icon: '📦' },
  { id: 'sistemas',         phase: 'Configuración',           label: 'Verificar conexiones activas',     detail: 'Comprueba que WhatsApp, email y las claves de IA estén configuradas correctamente.',          href: '/sistemas',    icon: '🌐' },
  // ── Captación ─────────────────────────────────────────────────────────────
  { id: 'import-prospects', phase: 'Captación de prospectos', label: 'Importar base de prospectos',      detail: 'Sube un PDF, Excel o CSV — la IA extrae y clasifica los contactos automáticamente.',           href: '/prospeccion', icon: '🔍' },
  { id: 'campaign',         phase: 'Captación de prospectos', label: 'Activar campaña de outreach',      detail: 'Activa la campaña para que el sistema contacte prospectos de forma natural y automática.',     href: '/prospeccion', icon: '📣' },
  // ── CRM ───────────────────────────────────────────────────────────────────
  { id: 'import-contacts',  phase: 'CRM y seguimiento',       label: 'Importar clientes existentes',     detail: 'Sube tu base de clientes actuales al CRM para gestión y seguimiento.',                        href: '/import',      icon: '📥' },
  { id: 'sequences',        phase: 'CRM y seguimiento',       label: 'Crear secuencia de seguimiento',   detail: 'Define pasos automáticos para nutrir y convertir leads calificados.',                         href: '/sequences',   icon: '🔁' },
  { id: 'leads',            phase: 'CRM y seguimiento',       label: 'Revisar leads y conversaciones',   detail: 'Analiza los leads que la IA clasificó, puntuó y con los que ya inició conversación.',         href: '/leads',       icon: '👥' },
  // ── Análisis ──────────────────────────────────────────────────────────────
  { id: 'tendencias',       phase: 'Análisis e inteligencia', label: 'Explorar tendencias del mercado',  detail: 'Descubre en tiempo real qué busca tu audiencia en Google y redes sociales.',                  href: '/tendencias',  icon: '📈' },
  { id: 'audiencias',       phase: 'Análisis e inteligencia', label: 'Exportar audiencias para anuncios', detail: 'Genera listas lookalike para Meta/Google Ads desde tus mejores clientes.',                  href: '/audiencias',  icon: '🎯' },
];

const STORAGE_KEY = 'mmap_guide_done_v1';
const PHASES = [...new Set(STEPS.map((s) => s.phase))];

export default function GuidePanel() {
  const [open, setOpen]         = useState(false);
  const [done, setDone]         = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[];
      setDone(new Set(saved));
    } catch { /* ignore */ }
    setHydrated(true);
  }, []);

  // Cerrar panel al navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  const toggle = useCallback((id: string) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  if (!hydrated) return <span style={{ width: 38, display: 'inline-block' }} />;

  const total     = STEPS.length;
  const completed = [...done].filter((id) => STEPS.some((s) => s.id === id)).length;
  const remaining = total - completed;
  const pct       = Math.round((completed / total) * 100);

  return (
    <>
      {/* ── Botón inline en la topbar ──────────────────────────────────── */}
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          onClick={() => setOpen((o) => !o)}
          title={open ? 'Cerrar guía' : `Guía de configuración · ${remaining} pasos pendientes`}
          style={{
            width:           38,
            height:          38,
            borderRadius:    '50%',
            background:      open ? '#4f46e5' : '#f8fafc',
            border:          `1.5px solid ${open ? '#4f46e5' : '#e5e9f0'}`,
            cursor:          'pointer',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            fontSize:        17,
            padding:         0,
            color:           open ? '#fff' : '#4f46e5',
            transition:      'all .2s',
            flexShrink:      0,
          }}
        >
          {open ? '✕' : '🧭'}
        </button>

        {/* Badge de pasos pendientes */}
        {!open && remaining > 0 && (
          <span style={{
            position:       'absolute',
            top:            -5,
            right:          -5,
            background:     '#f59e0b',
            color:          '#fff',
            borderRadius:   '50%',
            width:          18,
            height:         18,
            fontSize:       10,
            fontWeight:     700,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            border:         '2px solid #fff',
            pointerEvents:  'none',
          }}>
            {remaining}
          </span>
        )}
      </span>

      {/* ── Panel desplegable (fijo bajo la topbar) ────────────────────── */}
      {open && (
        <div
          style={{
            position:     'fixed',
            top:          62,
            right:        16,
            width:        350,
            maxHeight:    'calc(100vh - 80px)',
            overflowY:    'auto',
            background:   '#ffffff',
            border:       '1px solid #e5e9f0',
            borderRadius: 16,
            boxShadow:    '0 12px 40px rgba(15,23,42,.16)',
            zIndex:       500,
          }}
        >
          {/* Cabecera fija */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #f1f5f9', position: 'sticky', top: 0, background: '#fff', zIndex: 1, borderRadius: '16px 16px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>🧭</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a' }}>Guía de configuración</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{completed} de {total} pasos completados</div>
              </div>
              <span style={{ fontSize: 20, fontWeight: 700, color: pct === 100 ? '#22c55e' : '#4f46e5' }}>{pct}%</span>
            </div>

            {/* Barra de progreso */}
            <div style={{ background: '#f1f5f9', borderRadius: 999, height: 7, overflow: 'hidden' }}>
              <div style={{
                width:        `${pct}%`,
                height:       '100%',
                background:   pct === 100 ? '#22c55e' : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                transition:   'width .4s ease',
                borderRadius: 999,
              }} />
            </div>

            {pct === 100 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                ✅ ¡Sistema completamente configurado!
              </div>
            )}
          </div>

          {/* Pasos por fase */}
          <div style={{ paddingBottom: 8 }}>
            {PHASES.map((phase) => (
              <div key={phase}>
                <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.09em', color: '#94a3b8', padding: '14px 20px 5px' }}>
                  {phase}
                </div>

                {STEPS.filter((s) => s.phase === phase).map((step) => {
                  const isDone    = done.has(step.id);
                  const isCurrent = step.href === pathname || (step.href !== '/' && pathname.startsWith(step.href));

                  return (
                    <div
                      key={step.id}
                      style={{
                        display:     'flex',
                        alignItems:  'flex-start',
                        gap:         11,
                        padding:     '9px 20px',
                        background:  isCurrent ? '#f5f3ff' : 'transparent',
                        borderLeft:  `3px solid ${isCurrent ? '#6366f1' : 'transparent'}`,
                        transition:  'background .15s',
                      }}
                    >
                      {/* Checkbox */}
                      <button
                        onClick={() => toggle(step.id)}
                        title={isDone ? 'Marcar como pendiente' : 'Marcar como completado'}
                        style={{
                          flexShrink:     0,
                          width:          22,
                          height:         22,
                          borderRadius:   6,
                          border:         `2px solid ${isDone ? '#6366f1' : '#cbd5e1'}`,
                          background:     isDone ? '#6366f1' : '#fff',
                          cursor:         'pointer',
                          display:        'flex',
                          alignItems:     'center',
                          justifyContent: 'center',
                          fontSize:       12,
                          fontWeight:     700,
                          color:          '#fff',
                          padding:        0,
                          marginTop:      1,
                          transition:     'all .15s',
                        }}
                      >
                        {isDone ? '✓' : ''}
                      </button>

                      {/* Texto + link */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <a href={step.href} onClick={() => setOpen(false)} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ fontSize: 14 }}>{step.icon}</span>
                            <span style={{ fontWeight: 600, fontSize: 13, color: isDone ? '#94a3b8' : '#0f172a', textDecoration: isDone ? 'line-through' : 'none', lineHeight: 1.3 }}>
                              {step.label}
                            </span>
                          </div>
                          <div style={{ fontSize: 11.5, color: isDone ? '#cbd5e1' : '#64748b', marginTop: 3, lineHeight: 1.45 }}>
                            {step.detail}
                          </div>
                        </a>
                      </div>

                      {/* Flecha → */}
                      <a href={step.href} onClick={() => setOpen(false)} title={`Ir a ${step.label}`}
                        style={{ flexShrink: 0, color: isCurrent ? '#6366f1' : '#cbd5e1', fontSize: 16, display: 'flex', alignItems: 'center', paddingTop: 1, textDecoration: 'none', transition: 'color .15s' }}>
                        →
                      </a>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Pie */}
          <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
            Marca cada paso al completarlo · Haz clic en el nombre para ir al módulo
          </div>
        </div>
      )}
    </>
  );
}
