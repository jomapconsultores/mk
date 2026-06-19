-- =============================================================================
-- Seguridad: activar Row Level Security (RLS) en todas las tablas.
-- Con RLS activo y SIN politicas, las claves publicas (anon/authenticated) NO
-- pueden leer ni escribir. El backend usa la service_role, que ignora RLS, asi
-- que sigue funcionando. El panel usara politicas especificas en la Fase 2.
-- =============================================================================

alter table contacts            enable row level security;
alter table channel_identities  enable row level security;
alter table consents            enable row level security;
alter table conversations       enable row level security;
alter table messages            enable row level security;
alter table products            enable row level security;
alter table tags                enable row level security;
alter table contact_tags        enable row level security;
alter table sequences           enable row level security;
alter table sequence_steps      enable row level security;
alter table sequence_enrollments enable row level security;
alter table events              enable row level security;
alter table users               enable row level security;
