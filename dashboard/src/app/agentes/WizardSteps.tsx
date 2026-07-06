'use client';

import { useState } from 'react';
import { AGENT_CAPABILITIES } from '@/lib/agent-capabilities';
import { updateAgentDraft, publishAgent, unpublishAgent, deleteAgent } from './actions';

type Agent = {
  id: string;
  name: string;
  instructions: string;
  capabilities: string[];
  status: 'draft' | 'published';
  published_at: string | null;
};

const STEP_LABELS = ['Identificador', 'Instrucciones', 'Capacidades', 'Revisión y publicación'];

// Debe coincidir con ESCALATE_PREFIX en ./actions.ts. Se antepone
// automáticamente al guardar cuando "escalate_on_frustration" está marcada
// (ver actions.ts) — se oculta acá para que nadie la edite o borre a mano.
const ESCALATE_PREFIX =
  'Si detectas frustración fuerte o el cliente pide explícitamente hablar con una persona, ' +
  'responde EXACTAMENTE con el texto "[[ESCALATE_HUMANO]]" y nada más, sin agregar nada antes ni después.\n\n';

function displayInstructions(raw: string): string {
  return raw.startsWith(ESCALATE_PREFIX) ? raw.slice(ESCALATE_PREFIX.length) : raw;
}

export default function WizardSteps({ agent, initialStep }: { agent: Agent; initialStep: number }) {
  const [step, setStep] = useState(initialStep);
  const [capabilities, setCapabilities] = useState<Set<string>>(new Set(agent.capabilities));
  const [status, setStatus] = useState(agent.status);

  function toggleCapability(key: string, checked: boolean) {
    setCapabilities((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  return (
    <>
      {/* Indicador de pasos */}
      <div className="section" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            return (
              <button
                key={n}
                type="button"
                onClick={() => setStep(n)}
                style={{
                  background: n === step ? 'var(--brand)' : 'var(--panel-2)',
                  color: n === step ? '#fff' : 'var(--muted)',
                  border: '1px solid var(--border)',
                  fontSize: 12.5,
                  padding: '7px 14px',
                }}
              >
                {n}. {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Un único form para los 3 pasos editables: los campos de pasos no
          visibles quedan con display:none (siguen viajando en el submit),
          así nunca se pierde lo escrito al navegar entre pasos. */}
      <form action={updateAgentDraft.bind(null, agent.id)}>
        <div className="section" style={{ display: step === 1 ? 'block' : 'none' }}>
          <h3>1. Identificador único</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
            El nombre con el que identificás a este agente en el listado. No afecta lo que dice ni cómo se comporta.
          </p>
          <label>Nombre *</label>
          <input name="name" required defaultValue={agent.name} />
          <button type="submit" onClick={() => setStep(2)}>Guardar y continuar →</button>
        </div>

        <div className="section" style={{ display: step === 2 ? 'block' : 'none' }}>
          <h3>2. Instrucciones (personalidad y comportamiento)</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12, fontSize: 13 }}>
            Cómo debe hablar y comportarse este agente. Esto se agrega al prompt base del sistema, junto al
            framework de venta consultiva. Las reglas de seguridad (no inventar precios, honrar bajas de marketing,
            no presionar) siguen protegidas por código: nada de lo que escribas acá puede desactivarlas.
          </p>
          <textarea
            name="instructions"
            rows={10}
            defaultValue={displayInstructions(agent.instructions)}
            placeholder='Ej: "Sé cercano y usa emojis con moderación. Si preguntan por horarios, decí que atendemos de 9am a 6pm. Nunca menciones a la competencia."'
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setStep(1)}
            >
              ← Atrás
            </button>
            <button type="submit" onClick={() => setStep(3)}>Guardar y continuar →</button>
          </div>
        </div>

        <div className="section" style={{ display: step === 3 ? 'block' : 'none' }}>
          <h3>3. Herramientas y capacidades</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 16, fontSize: 13 }}>
            Qué puede hacer este agente. Todo lo que dejes sin marcar queda apagado.
          </p>
          {AGENT_CAPABILITIES.map((cap) => (
            <label
              key={cap.key}
              style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontWeight: 400, marginBottom: 14, cursor: 'pointer' }}
            >
              <input
                type="checkbox"
                name="capabilities"
                value={cap.key}
                defaultChecked={capabilities.has(cap.key)}
                onChange={(e) => toggleCapability(cap.key, e.target.checked)}
                style={{ width: 'auto', marginTop: 3, marginBottom: 0 }}
              />
              <span>
                <span style={{ display: 'block', fontWeight: 600, color: 'var(--text)' }}>{cap.label}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--muted)' }}>{cap.description}</span>
              </span>
            </label>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setStep(2)}
            >
              ← Atrás
            </button>
            <button type="submit" onClick={() => setStep(4)}>Guardar y continuar →</button>
          </div>
        </div>

        <div className="section" style={{ display: step === 4 ? 'block' : 'none' }}>
          <h3>4. Revisión y confirmación</h3>
          <p style={{ marginBottom: 8 }}><strong>Capacidades activas:</strong></p>
          {capabilities.size === 0 ? (
            <p style={{ color: 'var(--muted)', marginBottom: 16 }}>
              Ninguna marcada — este agente no respondería WhatsApp ni haría nada especial hasta que actives al menos una.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {AGENT_CAPABILITIES.filter((c) => capabilities.has(c.key)).map((c) => (
                <span key={c.key} className="badge" style={{ background: '#334155' }}>{c.label}</span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              type="button"
              style={{ background: 'var(--panel-2)', color: 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setStep(3)}
            >
              ← Atrás
            </button>
            <button type="submit">Guardar cambios</button>
            <a href={`/agentes/playground?agent=${agent.id}`} className="badge" style={{ background: '#0ea5e9' }}>
              🧪 Probar en Playground
            </a>
          </div>
        </div>
      </form>

      {/* Publicar / despublicar: no dependen de los campos del wizard, viven
          fuera del form de edición. */}
      <div className="section">
        <h3>Producción</h3>
        {status === 'published' ? (
          <>
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
              Este agente está publicado: es el que responde WhatsApp y llamadas ahora mismo.
            </p>
            <form action={unpublishAgent.bind(null, agent.id)} onSubmit={() => setStatus('draft')}>
              <button type="submit" style={{ background: '#475569' }}>Despublicar (vuelve a borrador)</button>
            </form>
          </>
        ) : (
          <>
            <p style={{ color: 'var(--muted)', marginBottom: 12 }}>
              Publicar reemplaza automáticamente al agente que esté publicado ahora, si hay uno.
            </p>
            <form
              action={publishAgent.bind(null, agent.id)}
              onSubmit={(e) => {
                const ok = confirm(
                  'Esto reemplazará al agente actualmente publicado (si hay uno): este pasará a atender ' +
                    'WhatsApp/llamadas en vivo de inmediato. ¿Continuar?',
                );
                if (!ok) { e.preventDefault(); return; }
                setStatus('published');
              }}
            >
              <button type="submit" style={{ background: '#22c55e' }}>Publicar este agente</button>
            </form>
          </>
        )}
      </div>

      {status !== 'published' && (
        <div className="section">
          <h3>Eliminar</h3>
          <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Esta acción no se puede deshacer.</p>
          <form
            action={deleteAgent.bind(null, agent.id)}
            onSubmit={(e) => {
              if (!confirm(`¿Eliminar "${agent.name}" definitivamente?`)) e.preventDefault();
            }}
          >
            <button className="danger" type="submit">Eliminar agente</button>
          </form>
        </div>
      )}
    </>
  );
}
