-- =============================================================================
-- Marketing MAP — Roles múltiples + permisos por rol
-- Reemplaza el modelo antiguo (permiso directo por usuario, users.role fijo)
-- por un modelo de roles: un usuario puede tener 2+ roles asignados
-- (user_roles) y cada request usa el ROL ACTIVO de la sesión para resolver
-- permisos (role_module_access). 'admin' es un rol más dentro de este
-- esquema pero NUNCA tiene filas en role_module_access: su acceso total se
-- resuelve en código (activeRole === 'admin'), así nunca puede quedar
-- bloqueado por un problema de datos.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create extension if not exists "pgcrypto";

-- Defensivo: por si este archivo llegó a correr parcialmente en algún entorno de dev/staging.
drop table if exists user_module_access;

-- -----------------------------------------------------------------------------
-- 1) Catálogo de roles (sin CHECK: se administra por SQL, no por UI, para
--    poder agregar roles a futuro sin tocar código de validación)
-- -----------------------------------------------------------------------------
create table if not exists roles (
  id         uuid primary key default gen_random_uuid(),
  key        text unique not null,
  label      text not null,
  created_at timestamptz not null default now()
);

insert into roles (key, label) values
  ('admin', 'Administrador'),
  ('socia', 'Socia'),
  ('agent', 'Asesor'),
  ('trabajador', 'Trabajador')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 2) Asignación de roles a usuarios (many-to-many: un usuario puede tener 2+ roles)
-- -----------------------------------------------------------------------------
create table if not exists user_roles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  role_id    uuid not null references roles(id) on delete cascade,
  granted_by uuid references users(id) on delete set null, -- auditoría: qué admin lo autorizó
  created_at timestamptz not null default now(),
  unique (user_id, role_id)
);
create index if not exists idx_user_roles_user on user_roles(user_id);

-- -----------------------------------------------------------------------------
-- 3) Accesos por rol (reemplaza a user_module_access; 'admin' nunca tiene
--    filas aquí: bypass total resuelto en código)
-- -----------------------------------------------------------------------------
create table if not exists role_module_access (
  id             uuid primary key default gen_random_uuid(),
  role_id        uuid not null references roles(id) on delete cascade,
  submodule_key  text not null check (submodule_key in (
    'captacion.activa', 'captacion.prospeccion',
    'ventas.pipeline', 'ventas.clientes',
    'automatizacion.seguimientos',
    'analitica.tablero', 'analitica.tendencias', 'analitica.audiencias',
    'configuracion.productos', 'configuracion.sistemas'
  )),
  created_at     timestamptz not null default now(),
  unique (role_id, submodule_key)
);
create index if not exists idx_role_module_access_role on role_module_access(role_id);

-- -----------------------------------------------------------------------------
-- 4) Migración de datos: cada usuario existente conserva su rol actual
--    (users.role) en user_roles, sin perder acceso.
--    Envuelto en un bloque defensivo: en una instalación NUEVA (schema.sql ya
--    no crea la columna users.role, ver sección 6) esta columna no existe —
--    se captura esa excepción puntual y se omite el backfill sin abortar el
--    resto del archivo, en vez de tumbar toda la migración.
-- -----------------------------------------------------------------------------
do $$ begin
  insert into user_roles (user_id, role_id)
  select u.id, r.id
  from users u
  join roles r on r.key = u.role
  on conflict (user_id, role_id) do nothing;
exception when undefined_column then
  raise notice 'users.role no existe (instalación nueva): se omite el backfill de roles legados.';
end $$;

-- -----------------------------------------------------------------------------
-- 5) Arranque sin fricción: socia y agent parten con TODO-ACCESO (igual que
--    la migración anterior daba todo-acceso por usuario); admin no recibe
--    filas (bypass total resuelto en código). El admin restringe después
--    manualmente desde /usuarios/roles.
--    'trabajador' queda EXCLUIDO a propósito: arranca sin ninguna fila en
--    role_module_access (cero permisos) y el admin se los otorga uno por uno
--    manualmente desde /usuarios/roles según lo requiera cada persona.
-- -----------------------------------------------------------------------------
insert into role_module_access (role_id, submodule_key)
select r.id, k
from roles r
cross join unnest(array[
  'captacion.activa', 'captacion.prospeccion',
  'ventas.pipeline', 'ventas.clientes',
  'automatizacion.seguimientos',
  'analitica.tablero', 'analitica.tendencias', 'analitica.audiencias',
  'configuracion.productos', 'configuracion.sistemas'
]) as k
where r.key not in ('admin', 'trabajador')
on conflict (role_id, submodule_key) do nothing;

-- -----------------------------------------------------------------------------
-- 6) users.role queda obsoleta: la fuente de verdad es user_roles.
--    (Efecto colateral aceptado: cambia el formato del token de sesión, así
--    que todas las sesiones activas quedan invalidadas al desplegar — cada
--    usuario debe volver a loguearse una vez.)
-- -----------------------------------------------------------------------------
alter table users drop column if exists role;
