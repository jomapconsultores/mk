-- =============================================================================
-- Marketing MAP — Módulo de Ventas IA (Fase 3): llamadas salientes con IA
-- Twilio ConversationRelay: llamadas telefónicas conducidas por el LLM.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create extension if not exists "pgcrypto";

-- Dirección de la llamada
do $$ begin
  create type call_direction as enum (
    'outbound',
    'inbound'
  );
exception when duplicate_object then null; end $$;

-- Estado de la llamada (calcado del ciclo de vida de una llamada de Twilio)
do $$ begin
  create type call_status as enum (
    'queued',
    'ringing',
    'in-progress',
    'completed',
    'failed',
    'no-answer',
    'busy',
    'canceled'
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- Llamadas — una fila por cada llamada iniciada o recibida
-- -----------------------------------------------------------------------------
create table if not exists calls (
  id                uuid primary key default gen_random_uuid(),
  contact_id        uuid references contacts(id) on delete set null,

  phone             text not null,
  direction         call_direction not null default 'outbound',
  status            call_status not null default 'queued',

  twilio_call_sid   text unique,

  -- Turnos de la conversación (ConversationRelay): [{role:'user'|'assistant', text, at}, ...]
  transcript        jsonb not null default '[]'::jsonb,

  outcome           text,          -- etiqueta corta del resultado (p.ej. 'interesado','no_contesta','pidio_no_llamar')
  summary           text,          -- resumen generado por IA al finalizar
  duration_seconds  int,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  ended_at          timestamptz
);

create index if not exists idx_calls_contact on calls(contact_id);
create index if not exists idx_calls_status  on calls(status);


-- -----------------------------------------------------------------------------
-- Trigger: mantener updated_at al día (reutiliza touch_updated_at() de schema.sql)
-- -----------------------------------------------------------------------------
do $$ begin
  create trigger trg_calls_updated before update on calls
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
