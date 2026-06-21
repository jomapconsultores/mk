-- Campos de IA extendidos en prospects (DISC, awareness, canal, icebreaker)
-- Aplicar en Supabase SQL Editor — proyecto pamplfrwwawfgvbzbndk

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS disc_estimate     text CHECK (disc_estimate IN ('D','I','S','C')),
  ADD COLUMN IF NOT EXISTS awareness_level   smallint CHECK (awareness_level BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS emotional_hook    text,
  ADD COLUMN IF NOT EXISTS best_channel      text CHECK (best_channel IN ('email','whatsapp','instagram')),
  ADD COLUMN IF NOT EXISTS icebreaker        text;

-- Resetear prospectos atascados en 'qualifying' → 'new' para re-calificación
UPDATE prospects SET status = 'new' WHERE status = 'qualifying';
