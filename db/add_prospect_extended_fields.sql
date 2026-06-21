-- Campos extendidos en prospects para importación inteligente
-- Aplicar después de add_prospecting.sql
-- Ya aplicado en Supabase el 2026-06-20

ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS first_name          text,
  ADD COLUMN IF NOT EXISTS last_name           text,
  ADD COLUMN IF NOT EXISTS phone_landline      text,   -- teléfono fijo/convencional
  ADD COLUMN IF NOT EXISTS phone_mobile        text,   -- celular (redundante con phone para claridad)
  ADD COLUMN IF NOT EXISTS email_personal      text,   -- gmail, hotmail, etc.
  ADD COLUMN IF NOT EXISTS email_institutional text;   -- dominio corporativo/institucional

CREATE INDEX IF NOT EXISTS idx_prospects_email_personal   ON prospects(email_personal)      WHERE email_personal      IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_email_inst       ON prospects(email_institutional)  WHERE email_institutional IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_phone_mobile     ON prospects(phone_mobile)         WHERE phone_mobile        IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_phone_landline   ON prospects(phone_landline)       WHERE phone_landline      IS NOT NULL;
