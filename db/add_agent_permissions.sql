-- =============================================================================
-- Marketing MAP — Agrega las claves de submódulo de "Agentes IA" al catálogo
-- de permisos (role_module_access.submodule_key), sin re-ejecutar
-- db/add_permissions.sql. Sigue el mismo patrón: DROP + ADD del CHECK.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

alter table role_module_access drop constraint if exists role_module_access_submodule_key_check;

alter table role_module_access add constraint role_module_access_submodule_key_check
  check (submodule_key in (
    'captacion.activa', 'captacion.prospeccion',
    'ventas.pipeline', 'ventas.clientes',
    'automatizacion.seguimientos',
    'analitica.tablero', 'analitica.tendencias', 'analitica.audiencias',
    'configuracion.productos', 'configuracion.sistemas',
    'agentes.gestion', 'agentes.playground'
  ));

-- A propósito NO se hace el insert masivo de "arranque sin fricción" que sí
-- se hizo en add_permissions.sql para los módulos originales: configurar el
-- Agente IA (system prompt de todo el negocio) es sensible. Ningún rol
-- no-admin recibe acceso automático; el admin lo otorga manualmente desde
-- /usuarios/roles, igual que ya se hace con 'trabajador'.
