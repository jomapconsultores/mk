'use client';

import { useState, useEffect } from 'react';
import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
} from '@simplewebauthn/browser';

const STORAGE_KEY = 'mmap_biometric_email';

type Mode = 'loading' | 'unsupported' | 'register' | 'login';

export default function BiometricButton() {
  const [mode,  setMode]  = useState<Mode>('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy,  setBusy]  = useState(false);

  useEffect(() => {
    if (!browserSupportsWebAuthn()) { setMode('unsupported'); return; }
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) { setEmail(saved); setMode('login'); }
    else        { setMode('register'); }
  }, []);

  async function handleRegister() {
    if (!email.trim()) { setError('Ingresa tu correo electrónico'); return; }
    setError(null); setBusy(true);
    try {
      const optRes = await fetch('/api/webauthn/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const { options, error: e } = await optRes.json();
      if (e) throw new Error(e);

      const credential = await startRegistration({ optionsJSON: options });

      const verRes = await fetch('/api/webauthn/register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), credential }),
      });
      const { ok, error: verErr } = await verRes.json();
      if (!ok) throw new Error(verErr ?? 'Error al registrar');

      localStorage.setItem(STORAGE_KEY, email.trim().toLowerCase());
      window.location.href = '/leads';
    } catch (e: any) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Registro cancelado. Intenta de nuevo y acepta el uso de biometría.'
          : e.message ?? 'Error desconocido',
      );
    } finally { setBusy(false); }
  }

  async function handleLogin() {
    setError(null); setBusy(true);
    try {
      const optRes = await fetch('/api/webauthn/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const { options, error: e } = await optRes.json();
      if (e) throw new Error(e);

      const assertion = await startAuthentication({ optionsJSON: options });

      const verRes = await fetch('/api/webauthn/login', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assertion }),
      });
      const { ok, error: verErr } = await verRes.json();
      if (!ok) throw new Error(verErr ?? 'Error al autenticar');

      window.location.href = '/leads';
    } catch (e: any) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Autenticación cancelada.'
          : e.message ?? 'Error desconocido',
      );
    } finally { setBusy(false); }
  }

  if (mode === 'loading' || mode === 'unsupported') return null;

  return (
    <div style={{ marginBottom: 20 }}>

      {mode === 'login' ? (
        /* ── MODO LOGIN biométrico ─────────────────────────── */
        <div>
          <button
            type="button"
            onClick={handleLogin}
            disabled={busy}
            style={{
              width: '100%',
              background: busy
                ? '#475569'
                : 'linear-gradient(120deg,#6366f1,#8b5cf6)',
              color: '#fff',
              padding: '13px',
              borderRadius: 12,
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              letterSpacing: '-.01em',
              boxShadow: busy ? 'none' : '0 4px 16px rgba(99,102,241,.4)',
              transition: 'all .2s',
            }}
          >
            <span style={{ fontSize: 22 }}>🔐</span>
            {busy ? 'Verificando identidad…' : 'Ingresar con huella / rostro'}
          </button>
          <div style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 6 }}>
            {email}
            {' · '}
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setMode('register');
                setEmail('');
              }}
              style={{
                background: 'none', border: 'none',
                color: '#6366f1', cursor: 'pointer',
                fontSize: 12, padding: 0,
              }}
            >
              Usar otro correo
            </button>
          </div>
        </div>
      ) : (
        /* ── MODO REGISTRO biométrico ──────────────────────── */
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
            Registrar huella digital o reconocimiento facial
          </div>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Tu correo electrónico"
            style={{
              width: '100%', marginBottom: 8,
              padding: '11px 14px', borderRadius: 10,
              border: '1.5px solid #e5e9f0', fontSize: 14,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleRegister}
            disabled={busy}
            style={{
              width: '100%',
              background: 'transparent',
              color: busy ? '#94a3b8' : '#6366f1',
              border: `2px solid ${busy ? '#e2e8f0' : '#6366f1'}`,
              padding: '11px',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              cursor: busy ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all .2s',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 20 }}>🪬</span>
            {busy ? 'Esperando autenticador…' : 'Registrar huella / rostro'}
          </button>
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 8, fontSize: 12, color: '#dc2626',
          background: '#fef2f2', border: '1px solid #fecaca',
          padding: '8px 12px', borderRadius: 8,
        }}>
          {error}
        </div>
      )}

      {/* Divisor */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 4px' }}>
        <div style={{ flex: 1, height: 1, background: '#e5e9f0' }} />
        <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>
          o ingresa con contraseña
        </span>
        <div style={{ flex: 1, height: 1, background: '#e5e9f0' }} />
      </div>
    </div>
  );
}
