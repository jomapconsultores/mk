-- =============================================================================
-- Marketing MAP — Esquema de base de datos (PostgreSQL / Supabase)
-- Sistema omnicanal de captación, clasificación y seguimiento de clientes.
--
-- Ejecutar en Supabase: SQL Editor → pegar este archivo → Run.
-- O con psql:  psql "$DATABASE_URL" -f db/schema.sql
-- =============================================================================

create extension if not exists "pgcrypto";   -- para gen_random_uuid()

-- -----------------------------------------------------------------------------
-- Tipos enumerados (los "estados" del sistema)
-- -----------------------------------------------------------------------------

-- Canales soportados
do $$ begin
  create type channel_type as enum ('whatsapp', 'instagram', 'facebook', 'email', 'web', 'sms');
exception when duplicate_object then null; end $$;

-- Etapa del cliente en el embudo de ventas
do $$ begin
  create type lead_stage as enum ('new', 'engaged', 'qualified', 'negotiating', 'customer', 'lost');
exception when duplicate_object then null; end $$;

-- Nivel de interés
do $$ begin
  create type interest_level as enum ('low', 'medium', 'high');
exception when duplicate_object then null; end $$;

-- Estado de consentimiento por canal
do $$ begin
  create type consent_status as enum ('opted_in', 'opted_out', 'pending');
exception when duplicate_object then null; end $$;

-- Dirección del mensaje
do $$ begin
  create type message_direction as enum ('inbound', 'outbound');
exception when duplicate_object then null; end $$;

-- Quién/qué envió un mensaje saliente
do $$ begin
  create type sender_type as enum ('ai', 'human', 'sequence', 'system');
exception when duplicate_object then null; end $$;

-- Estado de inscripción en una secuencia de seguimiento
do $$ begin
  create type enrollment_status as enum ('active', 'completed', 'stopped', 'failed');
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- Equipo (operadores que atienden y revisan)
-- -----------------------------------------------------------------------------
create table if not exists users (
  id           uuid primary key default gen_random_uuid(),
  email        text unique not null,
  full_name    text,
  role         text not null default 'agent',   -- 'admin' | 'agent'
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- Catálogo de productos / servicios (negocio mixto)
-- -----------------------------------------------------------------------------
create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  kind         text not null default 'product',  -- 'product' | 'service'
  price        numeric(12,2),
  currency     text not null default 'USD',
  is_active    boolean not null default true,
  -- texto que la IA usa para "convencer": beneficios, objeciones frecuentes, etc.
  sales_brief  text,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- CONTACTOS — el cliente como persona, independiente del canal
-- -----------------------------------------------------------------------------
create table if not exists contacts (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text,
  display_name          text,                 -- nombre/alias visible
  email                 text,
  phone                 text,                 -- E.164, p.ej. +51999888777
  country               text,
  language              text default 'es',

  -- Clasificación (la actualiza la IA)
  stage                 lead_stage not null default 'new',
  interest_level        interest_level,
  lead_score            int not null default 0 check (lead_score between 0 and 100),
  interested_product_id uuid references products(id) on delete set null,
  ai_summary            text,                 -- resumen breve del cliente que mantiene la IA

  -- Asignación al equipo
  assigned_to           uuid references users(id) on delete set null,

  -- Marketing global (resumen rápido; el detalle auditable está en `consents`)
  marketing_opted_out   boolean not null default false,
  opted_out_at          timestamptz,
  opt_out_reason        text,

  source_channel        channel_type,         -- por dónde llegó originalmente
  metadata              jsonb not null default '{}'::jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  last_contacted_at     timestamptz,
  last_inbound_at       timestamptz
);

create index if not exists idx_contacts_stage      on contacts(stage);
create index if not exists idx_contacts_score       on contacts(lead_score desc);
create index if not exists idx_contacts_assigned     on contacts(assigned_to);
create index if not exists idx_contacts_phone        on contacts(phone);
create index if not exists idx_contacts_email        on contacts(email);
create index if not exists idx_contacts_optout       on contacts(marketing_opted_out);


-- -----------------------------------------------------------------------------
-- IDENTIDADES POR CANAL — cómo se identifica el mismo contacto en cada canal
-- (un nº de WhatsApp, un IG id, un email...). Evita duplicar el cliente.
-- -----------------------------------------------------------------------------
create table if not exists channel_identities (
  id            uuid primary key default gen_random_uuid(),
  contact_id    uuid not null references contacts(id) on delete cascade,
  channel       channel_type not null,
  external_id   text not null,              -- nº WhatsApp / IG user id / email / etc.
  handle        text,                       -- @usuario u otro identificador legible
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (channel, external_id)
);

create index if not exists idx_identities_contact on channel_identities(contact_id);


-- -----------------------------------------------------------------------------
-- CONSENTIMIENTO — opt-in / opt-out auditable por canal (CUMPLIMIENTO LEGAL)
-- -----------------------------------------------------------------------------
create table if not exists consents (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references contacts(id) on delete cascade,
  channel      channel_type not null,
  status       consent_status not null default 'pending',
  source       text,                        -- 'inbound_message' | 'web_form' | 'manual' ...
  note         text,
  changed_at   timestamptz not null default now(),
  unique (contact_id, channel)
);

create index if not exists idx_consents_contact on consents(contact_id);


-- -----------------------------------------------------------------------------
-- ETIQUETAS — clasificación flexible adicional
-- -----------------------------------------------------------------------------
create table if not exists tags (
  id          uuid primary key default gen_random_uuid(),
  name        text unique not null,
  color       text
);

create table if not exists contact_tags (
  contact_id  uuid not null references contacts(id) on delete cascade,
  tag_id      uuid not null references tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);


-- -----------------------------------------------------------------------------
-- CONVERSACIONES y MENSAJES — historial completo por contacto y canal
-- -----------------------------------------------------------------------------
create table if not exists conversations (
  id              uuid primary key default gen_random_uuid(),
  contact_id      uuid not null references contacts(id) on delete cascade,
  channel         channel_type not null,
  status          text not null default 'open',   -- 'open' | 'closed' | 'snoozed'
  ai_autopilot    boolean not null default true,   -- ¿responde la IA sola en este hilo?
  last_message_at timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_conversations_contact on conversations(contact_id);
create index if not exists idx_conversations_status   on conversations(status);

create table if not exists messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references conversations(id) on delete cascade,
  contact_id        uuid not null references contacts(id) on delete cascade,
  channel           channel_type not null,
  direction         message_direction not null,
  sender_type       sender_type,                  -- para salientes: quién lo envió
  sender_user_id    uuid references users(id) on delete set null,
  body              text,
  media_url         text,
  external_id       text,                         -- id del mensaje en el proveedor
  -- Resultado de la clasificación de la IA sobre este mensaje (si es entrante)
  ai_intent         text,
  ai_analysis       jsonb,
  status            text default 'sent',          -- 'sent' | 'delivered' | 'read' | 'failed'
  created_at        timestamptz not null default now()
);

create index if not exists idx_messages_conversation on messages(conversation_id, created_at);
create index if not exists idx_messages_contact       on messages(contact_id, created_at);


-- -----------------------------------------------------------------------------
-- SECUENCIAS DE SEGUIMIENTO AUTOMÁTICO
-- -----------------------------------------------------------------------------
create table if not exists sequences (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  description   text,
  channel       channel_type,               -- canal preferido para enviar
  is_active     boolean not null default true,
  -- Disparador: a quién inscribir automáticamente (p.ej. {"stage":"new"})
  trigger       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists sequence_steps (
  id            uuid primary key default gen_random_uuid(),
  sequence_id   uuid not null references sequences(id) on delete cascade,
  step_order    int not null,
  delay_hours   int not null default 24,    -- espera desde el paso anterior
  -- El mensaje: plantilla fija o instrucción para que la IA lo redacte
  message_template text,
  ai_prompt        text,                    -- si se usa IA para personalizar
  -- Condición para enviar (p.ej. {"no_reply_since_last_step": true})
  send_condition   jsonb not null default '{}'::jsonb,
  unique (sequence_id, step_order)
);

create table if not exists sequence_enrollments (
  id              uuid primary key default gen_random_uuid(),
  sequence_id     uuid not null references sequences(id) on delete cascade,
  contact_id      uuid not null references contacts(id) on delete cascade,
  status          enrollment_status not null default 'active',
  current_step    int not null default 0,
  next_run_at     timestamptz,              -- cuándo toca el próximo paso
  enrolled_at     timestamptz not null default now(),
  completed_at    timestamptz,
  unique (sequence_id, contact_id)
);

create index if not exists idx_enroll_due on sequence_enrollments(status, next_run_at);


-- -----------------------------------------------------------------------------
-- BITÁCORA DE EVENTOS — auditoría y métricas
-- -----------------------------------------------------------------------------
create table if not exists events (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid references contacts(id) on delete cascade,
  type         text not null,              -- 'lead_created','classified','opted_out','sequence_sent'...
  payload      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_events_contact on events(contact_id, created_at);
create index if not exists idx_events_type     on events(type, created_at);


-- -----------------------------------------------------------------------------
-- Trigger: mantener updated_at al día
-- -----------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$ begin
  create trigger trg_contacts_updated  before update on contacts
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_products_updated  before update on products
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger trg_conversations_updated before update on conversations
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- Helper: registrar baja (opt-out) de forma consistente y auditable
-- Llamar:  select opt_out_contact('<uuid>', 'whatsapp', 'el cliente escribió STOP');
-- -----------------------------------------------------------------------------
create or replace function opt_out_contact(p_contact uuid, p_channel channel_type, p_reason text)
returns void as $$
begin
  update contacts
     set marketing_opted_out = true,
         opted_out_at = now(),
         opt_out_reason = p_reason
   where id = p_contact;

  insert into consents (contact_id, channel, status, source, note, changed_at)
  values (p_contact, p_channel, 'opted_out', 'inbound_message', p_reason, now())
  on conflict (contact_id, channel)
  do update set status = 'opted_out', note = p_reason, changed_at = now();

  -- Detener toda secuencia activa para este contacto
  update sequence_enrollments
     set status = 'stopped'
   where contact_id = p_contact and status = 'active';

  insert into events (contact_id, type, payload)
  values (p_contact, 'opted_out', jsonb_build_object('channel', p_channel, 'reason', p_reason));
end;
$$ language plpgsql;


-- =============================================================================
-- Datos de ejemplo (semilla mínima para probar) — opcional
-- =============================================================================
insert into tags (name, color) values
  ('VIP', '#FFD700'),
  ('Frío', '#90CAF9'),
  ('Caliente', '#EF5350')
on conflict (name) do nothing;
