-- =============================================================================
-- Marketing MAP — Índices para deduplicación de prospectos sin teléfono
-- google-maps.ts deduplica prospectos por (full_name) o (company) cuando no
-- hay número de teléfono disponible; estas columnas no tenían índice.
-- Ejecutar: SQL Editor de Supabase → pegar → Run
-- =============================================================================

create index if not exists idx_prospects_full_name on prospects(full_name);
create index if not exists idx_prospects_company    on prospects(company);
