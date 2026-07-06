-- =============================================================================
-- Marketing MAP — Agentes IA configurables sin código
-- Un Agente IA es un conjunto de instrucciones (personalidad/comportamiento) +
-- capacidades que se inyectan en generateReply() (chat) y, opcionalmente, en
-- el prompt de llamadas (calls/relay.ts). Solo puede haber UN agente con
-- status='published' a la vez: es el que efectivamente atiende conversaciones
-- reales. Los demás quedan en 'draft' (se pueden seguir editando/probando en
-- el Playground sin afectar producción).
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create extension if not exists "pgcrypto";

create table if not exists ai_agents (
  id             uuid primary key default gen_random_uuid(),

  name           text not null,                 -- identificador único visible ("Vendedor WhatsApp v2")
  instructions   text not null default '',       -- personalidad/comportamiento: se inyecta en el system prompt
  capabilities   jsonb not null default '[]'::jsonb, -- array de strings, ver AGENT_CAPABILITIES (backend/src/ai/agents.ts)

  status         text not null default 'draft' check (status in ('draft', 'published')),
  published_at   timestamptz,

  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create unique index if not exists ux_ai_agents_name on ai_agents (lower(name));

-- Garantiza en la BASE DE DATOS (no solo en la app) que nunca haya 2 agentes
-- publicados a la vez, incluso ante requests concurrentes: el índice solo
-- incluye filas con status='published' e indexa un valor constante, así que
-- una segunda fila publicada colisiona con la primera.
create unique index if not exists ux_ai_agents_single_published
  on ai_agents ((true)) where status = 'published';

do $$ begin
  create trigger trg_ai_agents_updated before update on ai_agents
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Publicar un agente de forma atómica: despublica el que estuviera publicado
-- y publica el nuevo, en una sola transacción (evita la ventana de carrera
-- donde dos updates separados desde la app dejarían 0 o 2 agentes publicados).
-- -----------------------------------------------------------------------------
create or replace function publish_ai_agent(p_id uuid) returns void as $$
begin
  update ai_agents set status = 'draft' where status = 'published' and id <> p_id;
  update ai_agents set status = 'published', published_at = now() where id = p_id;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- Trazabilidad: qué agente generó cada respuesta de IA (para auditoría/analítica,
-- no se usa como estado del pipeline). Nullable: los mensajes generados antes de
-- este módulo, o cuando no hay agente publicado, quedan con agent_id = null.
-- -----------------------------------------------------------------------------
alter table messages add column if not exists agent_id uuid references ai_agents(id) on delete set null;

-- -----------------------------------------------------------------------------
-- Escalado a humano: bandera simple para que "escalate_on_frustration" tenga
-- un efecto real y visible en el CRM (sin construir un sistema de notificaciones
-- nuevo; el equipo puede filtrar por esta columna desde /leads más adelante).
-- -----------------------------------------------------------------------------
alter table contacts add column if not exists needs_human boolean not null default false;
create index if not exists idx_contacts_needs_human on contacts(needs_human) where needs_human = true;
