-- =============================================================================
-- Marketing MAP — Módulo de Prospección Activa
-- Agrega tablas para buscar, calificar y contactar prospectos de forma natural.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create extension if not exists "pgcrypto";

-- Estado del prospecto en el pipeline
do $$ begin
  create type prospect_status as enum (
    'new',          -- recién ingresado, sin calificar
    'qualifying',   -- la IA está analizando su perfil
    'qualified',    -- calificado, listo para outreach
    'outreach',     -- en campaña activa de contacto
    'responded',    -- respondió algún mensaje
    'converted',    -- se convirtió en contacto (cliente potencial)
    'discarded'     -- descartado (no encaja o pidió baja)
  );
exception when duplicate_object then null; end $$;


-- -----------------------------------------------------------------------------
-- Fuentes de prospectos (de dónde vienen)
-- -----------------------------------------------------------------------------
create table if not exists prospect_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null,  -- 'csv_import' | 'google_maps' | 'social' | 'manual' | 'web_form'
  config      jsonb not null default '{}',
  created_at  timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- Prospectos — personas antes de que establezcan contacto voluntario
-- -----------------------------------------------------------------------------
create table if not exists prospects (
  id                      uuid primary key default gen_random_uuid(),
  source_id               uuid references prospect_sources(id) on delete set null,

  -- Información básica
  full_name               text,
  company                 text,
  email                   text,
  phone                   text,
  website                 text,
  industry                text,
  location                text,

  -- Calificación de la IA
  fit_score               int check (fit_score between 0 and 100),
  main_pain               text,         -- problema principal detectado
  outreach_angle          text,         -- cómo acercarse naturalmente
  recommended_product_id  uuid references products(id) on delete set null,
  ai_profile_summary      text,         -- perfil breve generado por IA

  -- Estado y conversión
  status                  prospect_status not null default 'new',
  contact_id              uuid references contacts(id) on delete set null, -- cuando convierte

  -- Datos crudos originales
  raw_data                jsonb not null default '{}',

  created_at              timestamptz not null default now(),
  qualified_at            timestamptz,
  responded_at            timestamptz,
  converted_at            timestamptz
);

create index if not exists idx_prospects_status    on prospects(status);
create index if not exists idx_prospects_score     on prospects(fit_score desc nulls last);
create index if not exists idx_prospects_phone     on prospects(phone);
create index if not exists idx_prospects_email     on prospects(email);


-- -----------------------------------------------------------------------------
-- Campañas de outreach (secuencias para prospectos fríos)
-- -----------------------------------------------------------------------------
create table if not exists outreach_campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,

  -- A quién dirigir (filtro flexible)
  target_filter   jsonb not null default '{}',
  -- Ej: {"fit_score_min": 60, "industry": "restaurantes", "location": "Quito"}

  -- Configuración de envío
  channel_order   text[] not null default '{email,whatsapp}',
  daily_limit     int not null default 20,     -- máx prospectos nuevos por día
  send_hour_start int not null default 9,
  send_hour_end   int not null default 18,

  is_active       boolean not null default false,
  created_at      timestamptz not null default now()
);


-- -----------------------------------------------------------------------------
-- Pasos de cada campaña
-- -----------------------------------------------------------------------------
create table if not exists outreach_steps (
  id                uuid primary key default gen_random_uuid(),
  campaign_id       uuid not null references outreach_campaigns(id) on delete cascade,
  step_order        int not null,
  delay_hours       int not null default 0,   -- 0 = enviar al inscribir

  -- Intención del mensaje (define el tono del agente redactor)
  message_intent    text not null default 'value_first',
  -- 'value_first' | 'followup_question' | 'social_proof' | 'breakup'

  -- Cómo generar el mensaje (IA o plantilla fija)
  ai_prompt         text,
  message_template  text,

  unique (campaign_id, step_order)
);


-- -----------------------------------------------------------------------------
-- Seguimiento individual: qué prospecto está en qué paso de qué campaña
-- -----------------------------------------------------------------------------
create table if not exists outreach_enrollments (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references outreach_campaigns(id) on delete cascade,
  prospect_id     uuid not null references prospects(id) on delete cascade,

  status          text not null default 'active',
  -- 'active' | 'responded' | 'converted' | 'stopped' | 'failed'

  current_step    int not null default 0,
  channel_used    text,                       -- canal por el que se contactó
  next_run_at     timestamptz,

  enrolled_at     timestamptz not null default now(),
  responded_at    timestamptz,
  converted_at    timestamptz,

  unique (campaign_id, prospect_id)
);

create index if not exists idx_outreach_enroll_due on outreach_enrollments(status, next_run_at);


-- -----------------------------------------------------------------------------
-- Mensajes enviados a prospectos (para auditoría)
-- -----------------------------------------------------------------------------
create table if not exists outreach_messages (
  id              uuid primary key default gen_random_uuid(),
  enrollment_id   uuid not null references outreach_enrollments(id) on delete cascade,
  prospect_id     uuid not null references prospects(id) on delete cascade,
  step_order      int not null,
  channel         text not null,
  body            text not null,
  status          text not null default 'sent',  -- 'sent' | 'delivered' | 'failed'
  sent_at         timestamptz not null default now()
);

create index if not exists idx_outreach_msgs_prospect on outreach_messages(prospect_id, sent_at);


-- -----------------------------------------------------------------------------
-- Semilla: campaña de bienvenida con 4 pasos naturales
-- -----------------------------------------------------------------------------
insert into outreach_campaigns (name, description, channel_order, daily_limit, is_active)
values (
  'Prospección Natural — General',
  'Secuencia de 4 toques: valor → pregunta → prueba social → cierre suave',
  '{email,whatsapp}',
  20,
  false  -- se activa manualmente cuando esté listo
) on conflict do nothing;

-- Pasos de la campaña (se insertan referenciando la campaña recién creada)
with camp as (
  select id from outreach_campaigns
  where name = 'Prospección Natural — General' limit 1
)
insert into outreach_steps (campaign_id, step_order, delay_hours, message_intent, ai_prompt)
select
  camp.id,
  s.step_order,
  s.delay_hours,
  s.message_intent,
  s.ai_prompt
from camp,
(values
  (1, 0,   'value_first',       'Escribe un primer mensaje de contacto breve y natural (2-3 líneas). NO vendas nada todavía. Ofrece UN consejo o insight valioso y específico para su industria/empresa. Termina con una pregunta abierta que invite a responder. Tono cercano, tuteo.'),
  (2, 72,  'followup_question', 'Escribe un seguimiento corto (2 líneas). Reconoce que quizás es mal momento. Haz UNA pregunta específica sobre el reto principal que probablemente tiene alguien en su industria. No menciones productos.'),
  (3, 168, 'social_proof',      'Comparte en 2-3 líneas un resultado concreto que logramos con un cliente similar a este prospecto. Sin inventar datos: usa frases como "clientes como tú han visto..." o "en casos similares...". Luego ofrece mostrarlo.'),
  (4, 336, 'breakup',           'Mensaje de cierre suave (2 líneas). Entiende que puede no ser el momento. Deja la puerta abierta sin presión. Despídete de forma cálida. NO pidas compra.')
) as s(step_order, delay_hours, message_intent, ai_prompt)
on conflict do nothing;
