-- =============================================================================
-- Marketing MAP — Agrega 'ventas.pedidos' al catálogo de permisos
-- (role_module_access.submodule_key), sin re-ejecutar migraciones anteriores.
-- Mismo patrón que db/add_agent_permissions.sql: DROP + ADD del CHECK.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

alter table role_module_access drop constraint if exists role_module_access_submodule_key_check;

alter table role_module_access add constraint role_module_access_submodule_key_check
  check (submodule_key in (
    'captacion.activa', 'captacion.prospeccion',
    'ventas.pipeline', 'ventas.clientes', 'ventas.pedidos',
    'automatizacion.seguimientos',
    'analitica.tablero', 'analitica.tendencias', 'analitica.audiencias',
    'configuracion.productos', 'configuracion.sistemas',
    'agentes.gestion', 'agentes.playground'
  ));

-- Sin insert masivo de arranque: igual que 'agentes.gestion', un módulo nuevo
-- que toca dinero/pedidos no se otorga automáticamente a ningún rol no-admin;
-- el admin lo asigna manualmente desde /usuarios/roles.
