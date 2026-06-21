-- Credenciales WebAuthn (huella digital / reconocimiento facial)
CREATE TABLE IF NOT EXISTS user_webauthn_credentials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email    text NOT NULL,
  credential_id text NOT NULL UNIQUE,
  public_key    text NOT NULL,           -- COSE key en base64url
  counter       bigint NOT NULL DEFAULT 0,
  transports    text[],                  -- ['internal'] para biometría del dispositivo
  device_label  text,                    -- 'iPhone de Juan', 'MacBook Pro', etc.
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webauthn_email ON user_webauthn_credentials(user_email);
