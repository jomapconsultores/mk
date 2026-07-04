'use client';
import { useEffect } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --brand:   #4f46e5;
  --brand2:  #7c3aed;
  --accent:  #06b6d4;
  --ink:     #0f172a;
  --muted:   #64748b;
  --border:  #e5e9f0;
  --bg:      #f6f7fb;
  --white:   #ffffff;
  --green:   #22c55e;
  --radius:  16px;
  --shadow:  0 4px 24px rgba(15,23,42,.08);
  --shadow-lg: 0 16px 48px rgba(15,23,42,.14);
}
html { scroll-behavior: smooth; }
body {
  font-family: var(--font-inter), 'Inter', system-ui, sans-serif;
  color: var(--ink); background: #ffffff !important;
  -webkit-font-smoothing: antialiased; letter-spacing: -.01em;
}
a { color: var(--brand); text-decoration: none; }
a:hover { text-decoration: underline; }
img { max-width: 100%; }

.lp-container { max-width: 1100px; margin: 0 auto; padding: 0 28px; }
.lp .btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 28px; border-radius: 12px; font-weight: 700;
  font-size: 15px; cursor: pointer; border: none; font-family: inherit;
  transition: all .2s; text-decoration: none;
}
.lp .btn-primary {
  background: linear-gradient(120deg, var(--brand), var(--brand2));
  color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,.35);
}
.lp .btn-primary:hover { opacity: .92; transform: translateY(-1px); box-shadow: 0 8px 24px rgba(79,70,229,.45); text-decoration: none; }
.lp .btn-outline {
  background: transparent; color: var(--brand);
  border: 2px solid var(--brand);
}
.lp .btn-outline:hover { background: var(--brand); color: #fff; text-decoration: none; }
.lp .badge-pill {
  display: inline-flex; align-items: center; gap: 7px;
  background: #eef2ff; color: var(--brand); border-radius: 999px;
  padding: 6px 14px; font-size: 13px; font-weight: 600;
}
.lp .badge-pill .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); box-shadow: 0 0 0 3px rgba(34,197,94,.2); }
.lp .section-label {
  font-size: 12px; font-weight: 700; text-transform: uppercase;
  letter-spacing: .1em; color: var(--brand); margin-bottom: 12px;
}
.lp .gradient-text {
  background: linear-gradient(120deg, var(--brand), var(--brand2));
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}

/* Navbar */
.lp nav {
  position: sticky; top: 0; z-index: 100; background: rgba(255,255,255,.9);
  backdrop-filter: blur(12px); border-bottom: 1px solid var(--border);
}
.lp .nav-inner {
  display: flex; align-items: center; justify-content: space-between;
  height: 68px;
}
.lp .logo { display: flex; align-items: center; gap: 11px; }
.lp .logo-mark {
  width: 38px; height: 38px; border-radius: 11px; flex-shrink: 0;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 900; font-size: 19px;
  box-shadow: 0 4px 12px rgba(99,102,241,.4);
}
.lp .logo-name { font-weight: 800; font-size: 18px; color: var(--ink); }
.lp .logo-tag  { font-size: 11px; color: var(--muted); margin-top: 1px; }
.lp .nav-links { display: flex; align-items: center; gap: 28px; }
.lp .nav-links a { color: var(--muted); font-weight: 500; font-size: 14px; }
.lp .nav-links a:hover { color: var(--ink); text-decoration: none; }

/* Hero */
.lp .hero {
  padding: 90px 0 80px;
  background: linear-gradient(160deg, #f5f3ff 0%, #eef2ff 40%, #f0f9ff 100%);
  overflow: hidden;
}
.lp .hero-grid {
  display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center;
}
.lp .hero h1 {
  font-size: 50px; line-height: 1.08; font-weight: 900;
  letter-spacing: -.035em; margin-bottom: 20px;
}
.lp .hero .lead {
  font-size: 18px; color: var(--muted); line-height: 1.65; margin-bottom: 32px;
}
.lp .hero-actions { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 36px; }
.lp .hero-trust {
  display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--muted);
}
.lp .hero-trust .avatars { display: flex; }
.lp .hero-trust .avatars span {
  width: 30px; height: 30px; border-radius: 50%; border: 2px solid #fff;
  background: linear-gradient(135deg, #6366f1, #8b5cf6);
  display: flex; align-items: center; justify-content: center;
  font-size: 11px; font-weight: 700; color: #fff; margin-left: -8px;
}
.lp .hero-trust .avatars span:first-child { margin-left: 0; }

/* Phone mockup */
.lp .phone-wrap {
  display: flex; justify-content: center; align-items: center;
  position: relative;
}
.lp .phone {
  width: 280px; background: #fff; border-radius: 36px;
  box-shadow: var(--shadow-lg), 0 0 0 8px rgba(79,70,229,.08);
  overflow: hidden; border: 1px solid var(--border);
  position: relative; z-index: 2;
}
.lp .phone-bar {
  background: linear-gradient(120deg, #4f46e5, #7c3aed);
  padding: 14px 18px; color: #fff;
}
.lp .phone-bar .agent { font-size: 12px; opacity: .7; }
.lp .phone-bar .name  { font-size: 15px; font-weight: 700; }
.lp .phone-bar .status{ font-size: 11px; opacity: .8; margin-top: 2px; }
.lp .chat { padding: 14px; display: flex; flex-direction: column; gap: 10px; background: #f0f4f8; }
.lp .msg-bubble { max-width: 82%; padding: 10px 13px; border-radius: 14px; font-size: 12.5px; line-height: 1.5; }
.lp .msg-in  { background: #fff; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.lp .msg-out { background: #dcf8c6; border-bottom-right-radius: 4px; align-self: flex-end; }
.lp .msg-ai  { background: linear-gradient(120deg,#eef2ff,#f5f3ff); border-bottom-left-radius: 4px; border-left: 3px solid #6366f1; }
.lp .msg-time { font-size: 10px; color: #94a3b8; text-align: right; margin-top: 3px; }
.lp .typing { display: flex; gap: 4px; align-items: center; padding: 6px 0; }
.lp .typing span { width: 7px; height: 7px; border-radius: 50%; background: #94a3b8; animation: lp-bounce .9s ease-in-out infinite; }
.lp .typing span:nth-child(2) { animation-delay: .15s; }
.lp .typing span:nth-child(3) { animation-delay: .30s; }
@keyframes lp-bounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-5px)} }

.lp .float-card {
  position: absolute; background: #fff; border: 1px solid var(--border);
  border-radius: 14px; padding: 12px 16px; box-shadow: var(--shadow-lg);
  font-size: 13px; font-weight: 600; white-space: nowrap;
}
.lp .float-card .num { font-size: 22px; font-weight: 800; color: var(--brand); }
.lp .float-1 { top: 30px;  right: -20px; }
.lp .float-2 { bottom: 60px; left: -30px; }

/* Stats */
.lp .stats { padding: 40px 0; background: var(--ink); }
.lp .stats-grid {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 32px; text-align: center;
}
.lp .stat-num  { font-size: 38px; font-weight: 900; color: #fff; letter-spacing: -.03em; }
.lp .stat-label{ font-size: 13px; color: #94a3b8; margin-top: 4px; }

/* Problema */
.lp .problem { padding: 90px 0; background: var(--bg); }
.lp .problem h2 { font-size: 36px; font-weight: 800; margin-bottom: 14px; letter-spacing: -.02em; }
.lp .problem .sub { font-size: 17px; color: var(--muted); max-width: 560px; line-height: 1.6; margin-bottom: 44px; }
.lp .pain-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.lp .pain-card {
  background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 24px; box-shadow: var(--shadow);
}
.lp .pain-card .ico { font-size: 28px; margin-bottom: 12px; }
.lp .pain-card h4  { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
.lp .pain-card p   { font-size: 13.5px; color: var(--muted); line-height: 1.5; }

/* Solución */
.lp .solution { padding: 90px 0; }
.lp .solution-header { text-align: center; margin-bottom: 60px; }
.lp .solution-header h2 { font-size: 38px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 14px; }
.lp .solution-header p  { font-size: 17px; color: var(--muted); max-width: 540px; margin: 0 auto; line-height: 1.6; }
.lp .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.lp .feat {
  background: #fff; border: 1px solid var(--border); border-radius: var(--radius);
  padding: 28px; box-shadow: var(--shadow); transition: transform .2s, box-shadow .2s;
}
.lp .feat:hover { transform: translateY(-4px); box-shadow: var(--shadow-lg); }
.lp .feat-icon {
  width: 50px; height: 50px; border-radius: 14px; margin-bottom: 18px;
  display: flex; align-items: center; justify-content: center; font-size: 22px;
}
.lp .feat h3  { font-size: 16px; font-weight: 700; margin-bottom: 8px; }
.lp .feat p   { font-size: 13.5px; color: var(--muted); line-height: 1.55; }

/* Cómo funciona */
.lp .how { padding: 90px 0; background: var(--bg); }
.lp .how-header { text-align: center; margin-bottom: 60px; }
.lp .how-header h2 { font-size: 36px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 12px; }
.lp .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; position: relative; }
.lp .steps::before {
  content: ''; position: absolute; top: 36px; left: calc(16.6% + 20px); right: calc(16.6% + 20px);
  height: 2px; background: linear-gradient(90deg,var(--brand),var(--brand2)); z-index: 0;
}
.lp .step { text-align: center; position: relative; z-index: 1; }
.lp .step-num {
  width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 22px;
  background: linear-gradient(135deg,var(--brand),var(--brand2));
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; font-weight: 900; color: #fff;
  box-shadow: 0 8px 24px rgba(79,70,229,.35);
}
.lp .step h3 { font-size: 17px; font-weight: 700; margin-bottom: 10px; }
.lp .step p  { font-size: 14px; color: var(--muted); line-height: 1.55; }

/* Resultados */
.lp .results {
  padding: 90px 0;
  background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%);
}
.lp .results-header { text-align: center; margin-bottom: 60px; }
.lp .results-header h2 { font-size: 36px; font-weight: 800; color: #fff; letter-spacing: -.02em; margin-bottom: 12px; }
.lp .results-header p  { font-size: 16px; color: #94a3b8; max-width: 500px; margin: 0 auto; }
.lp .results-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
.lp .result-card {
  background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.12);
  border-radius: var(--radius); padding: 32px 28px; text-align: center;
}
.lp .result-card .num { font-size: 48px; font-weight: 900; letter-spacing: -.04em; margin-bottom: 8px; }
.lp .result-card .lbl { font-size: 14px; color: #94a3b8; line-height: 1.4; }

/* Testimonio */
.lp .testimonial { padding: 80px 0; }
.lp .test-card {
  max-width: 680px; margin: 0 auto; text-align: center;
  background: var(--bg); border: 1px solid var(--border);
  border-radius: 24px; padding: 48px 40px; box-shadow: var(--shadow);
}
.lp .stars { font-size: 22px; margin-bottom: 20px; }
.lp .test-card blockquote {
  font-size: 20px; font-weight: 600; line-height: 1.5;
  color: var(--ink); margin-bottom: 24px; font-style: italic;
}
.lp .test-author { font-size: 14px; color: var(--muted); }
.lp .test-author strong { color: var(--ink); display: block; font-size: 15px; margin-bottom: 2px; }

/* Formulario */
.lp .contact { padding: 90px 0; background: var(--bg); }
.lp .contact-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
.lp .contact-left h2 { font-size: 36px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 14px; }
.lp .contact-left p  { font-size: 16px; color: var(--muted); line-height: 1.6; margin-bottom: 28px; }
.lp .contact-feature { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; font-size: 14px; font-weight: 500; }
.lp .contact-feature .ck {
  width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
  background: #dcfce7; color: #16a34a;
  display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800;
}
.lp .form-card {
  background: #fff; border: 1px solid var(--border); border-radius: 24px;
  padding: 36px; box-shadow: var(--shadow-lg);
}
.lp .form-card h3 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
.lp .form-card .sub { font-size: 14px; color: var(--muted); margin-bottom: 24px; }
.lp .form-field { margin-bottom: 16px; }
.lp .form-field label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 6px; }
.lp .form-field input, .lp .form-field textarea {
  width: 100%; padding: 12px 14px; border: 1.5px solid var(--border);
  border-radius: 11px; font-size: 14px; font-family: inherit;
  transition: border .15s, box-shadow .15s; background: #fff;
}
.lp .form-field input:focus, .lp .form-field textarea:focus {
  outline: none; border-color: var(--brand); box-shadow: 0 0 0 3px rgba(79,70,229,.12);
}
.lp .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.lp .consent-label {
  display: flex; gap: 10px; align-items: flex-start; font-size: 12.5px;
  color: var(--muted); cursor: pointer; margin: 16px 0;
}
.lp .consent-label input { width: auto; flex-shrink: 0; margin-top: 2px; }
.lp .form-submit {
  width: 100%; padding: 15px; border: none; border-radius: 12px; font-family: inherit;
  background: linear-gradient(120deg, var(--brand), var(--brand2));
  color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;
  transition: opacity .15s, transform .1s; box-shadow: 0 4px 16px rgba(79,70,229,.35);
}
.lp .form-submit:hover { opacity: .92; transform: translateY(-1px); }
.lp .form-submit:disabled { opacity: .6; cursor: not-allowed; transform: none; }
.lp .note { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 12px; }
.lp .ok-view { text-align: center; padding: 32px 0; }
.lp .ok-view .big { font-size: 56px; margin-bottom: 12px; }
.lp .ok-view h3 { color: #16a34a; font-size: 22px; margin-bottom: 8px; }
.lp .ok-view p { color: var(--muted); font-size: 15px; }
.lp .hidden { display: none !important; }

/* Footer */
.lp footer {
  background: var(--ink); color: #94a3b8; padding: 48px 0 28px;
}
.lp .footer-grid {
  display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 48px; margin-bottom: 40px;
}
.lp .footer-brand .logo-name { color: #fff; }
.lp .footer-brand .logo-tag  { color: #475569; }
.lp .footer-brand p { font-size: 13.5px; color: #64748b; margin-top: 14px; line-height: 1.6; max-width: 280px; }
.lp .footer-col h4 { font-size: 13px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 14px; }
.lp .footer-col a  { display: block; font-size: 13.5px; color: #64748b; margin-bottom: 8px; }
.lp .footer-col a:hover { color: #fff; text-decoration: none; }
.lp .footer-bottom {
  border-top: 1px solid rgba(255,255,255,.07); padding-top: 24px;
  display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;
  font-size: 12.5px;
}

/* Responsive */
@media (max-width: 900px) {
  .lp .hero-grid, .lp .contact-grid, .lp .footer-grid { grid-template-columns: 1fr; gap: 40px; }
  .lp .hero h1 { font-size: 36px; }
  .lp .phone-wrap { display: none; }
  .lp .steps::before { display: none; }
  .lp .stats-grid   { grid-template-columns: repeat(2,1fr); }
  .lp .pain-grid    { grid-template-columns: 1fr; }
  .lp .features-grid{ grid-template-columns: 1fr; }
  .lp .steps        { grid-template-columns: 1fr; }
  .lp .results-grid { grid-template-columns: 1fr; }
  .lp .form-row     { grid-template-columns: 1fr; }
  .lp .nav-links    { display: none; }
}
`;

export default function LandingPage() {
  useEffect(() => {
    const form     = document.getElementById('lead-form') as HTMLFormElement | null;
    const btn      = document.getElementById('submit-btn') as HTMLButtonElement | null;
    const formView = document.getElementById('form-view') as HTMLElement | null;
    const okView   = document.getElementById('ok-view') as HTMLElement | null;
    if (!form || !btn || !formView || !okView) return;

    const handler = async (e: Event) => {
      e.preventDefault();
      const fd = new FormData(form);
      const name    = ((fd.get('name')    as string) ?? '').trim();
      const phone   = ((fd.get('phone')   as string) ?? '').trim();
      const email   = ((fd.get('email')   as string) ?? '').trim();
      const message = ((fd.get('message') as string) ?? '').trim();
      const company = ((fd.get('company') as string) ?? '').trim();

      if (!phone && !email) {
        alert('Por favor déjanos al menos tu WhatsApp o tu correo electrónico.');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Enviando…';
      try {
        const res = await fetch(BACKEND + '/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, phone, email, message: company ? `${message} | Empresa: ${company}` : message }),
        });
        if (!res.ok) throw new Error('status ' + res.status);
        formView.classList.add('hidden');
        okView.classList.remove('hidden');
      } catch {
        alert('Hubo un problema al enviar. Por favor inténtalo de nuevo.');
        btn.disabled = false;
        btn.textContent = 'Quiero mi demo gratuita →';
      }
    };

    form.addEventListener('submit', handler);
    return () => form.removeEventListener('submit', handler);
  }, []);

  return (
    <div className="lp">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* NAVBAR */}
      <nav>
        <div className="lp-container">
          <div className="nav-inner">
            <a href="#" className="logo" style={{ textDecoration: 'none' }}>
              <div className="logo-mark">m</div>
              <div>
                <div className="logo-name">Marketing MAP</div>
                <div className="logo-tag">Captación con IA</div>
              </div>
            </a>
            <div className="nav-links">
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#beneficios">Beneficios</a>
              <a href="#contacto">Contacto</a>
              <a href="/login" style={{ color: 'var(--brand)', fontWeight: 600 }}>Ingresar al sistema →</a>
            </div>
            <a href="#contacto" className="btn btn-primary" style={{ fontSize: 14, padding: '11px 22px' }}>
              Solicitar demo gratuita
            </a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="hero">
        <div className="lp-container">
          <div className="hero-grid">
            <div className="hero-content">
              <div className="badge-pill" style={{ marginBottom: 24 }}>
                <span className="dot" />
                Sistema activo · Inteligencia Artificial
              </div>
              <h1>
                Capta más clientes<br />con <span className="gradient-text">Inteligencia<br />Artificial</span>
              </h1>
              <p className="lead">
                Marketing MAP responde tus mensajes de WhatsApp al instante, califica prospectos
                automáticamente y da seguimiento 24/7 — mientras tú te enfocas en cerrar ventas.
              </p>
              <div className="hero-actions">
                <a href="#contacto" className="btn btn-primary">Quiero probarlo gratis →</a>
                <a href="#como-funciona" className="btn btn-outline">Ver cómo funciona</a>
              </div>
              <div className="hero-trust">
                <div className="avatars">
                  <span>JM</span><span>AM</span><span>CP</span><span>RL</span>
                </div>
                <span>+50 empresas ya automatizan con Marketing MAP</span>
              </div>
            </div>

            <div className="phone-wrap">
              <div className="phone">
                <div className="phone-bar">
                  <div className="agent">🤖 Marketing MAP IA</div>
                  <div className="name">Ana González</div>
                  <div className="status">● En línea · Respondiendo</div>
                </div>
                <div className="chat">
                  <div className="msg-bubble msg-in">
                    Hola, vi su publicidad. ¿Cuánto cuesta el servicio? 🤔
                    <div className="msg-time">10:24</div>
                  </div>
                  <div className="typing">
                    <span /><span /><span />
                  </div>
                  <div className="msg-bubble msg-ai">
                    ¡Hola Ana! 👋 Con gusto te cuento. Tenemos 3 planes diseñados para negocios como el tuyo. ¿Te dedicas más al área de servicios o productos?
                    <div className="msg-time">10:24 ✓✓</div>
                  </div>
                  <div className="msg-bubble msg-in">
                    Servicios, tengo una clínica dental.
                    <div className="msg-time">10:25</div>
                  </div>
                  <div className="msg-bubble msg-ai">
                    ¡Perfecto! Para clínicas dentales tenemos resultados excelentes. Te envío la propuesta específica para tu caso. ¿Prefieres que te llame por WhatsApp o email?
                    <div className="msg-time">10:25 ✓✓</div>
                  </div>
                </div>
              </div>
              <div className="float-card float-1">
                <div className="num">3s</div>
                <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Tiempo de respuesta IA</div>
              </div>
              <div className="float-card float-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#22c55e', fontSize: 18 }}>↑</span>
                  <div>
                    <div className="num" style={{ fontSize: 20, color: '#22c55e' }}>+340%</div>
                    <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Más leads atendidos</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="stats">
        <div className="lp-container">
          <div className="stats-grid">
            <div><div className="stat-num">24/7</div><div className="stat-label">Atención ininterrumpida</div></div>
            <div><div className="stat-num">&lt;5s</div><div className="stat-label">Respuesta automática IA</div></div>
            <div><div className="stat-num">+3x</div><div className="stat-label">Más leads convertidos</div></div>
            <div><div className="stat-num">0</div><div className="stat-label">Leads perdidos por demora</div></div>
          </div>
        </div>
      </section>

      {/* PROBLEMA */}
      <section className="problem">
        <div className="lp-container">
          <div className="section-label">El problema</div>
          <h2>¿Cuántos clientes pierdes<br />cada día por no responder a tiempo?</h2>
          <p className="sub">
            El 80% de los leads compra a quien responde primero. Si tardas más de 5 minutos,
            ya se fue con tu competencia.
          </p>
          <div className="pain-grid">
            {[
              { ico: '😤', t: 'Mensajes sin responder', d: 'Tu equipo no puede atender 100 WhatsApps al mismo tiempo. Los leads se enfrían y se van.' },
              { ico: '⏰', t: 'Horas fuera de oficina', d: 'Los clientes no esperan al lunes. Si no respondes el domingo a las 10pm, alguien más sí lo hará.' },
              { ico: '🔄', t: 'Seguimientos olvidados', d: 'El 44% de las ventas se cierran en el 5to contacto. Nadie tiene tiempo para rastrear eso manualmente.' },
              { ico: '📊', t: 'Sin datos de tus leads', d: 'No sabes de dónde vienen, qué les interesa ni cuáles tienen más probabilidad de comprar.' },
              { ico: '💸', t: 'Inversión en publicidad perdida', d: 'Pagas por generar leads pero si no los atiendes bien, todo ese dinero se va a la basura.' },
              { ico: '🤷', t: 'Equipo saturado', d: 'Tus asesores repiten lo mismo 50 veces al día. Se cansan, cometen errores y pierden motivación.' },
            ].map(({ ico, t, d }) => (
              <div key={t} className="pain-card">
                <div className="ico">{ico}</div>
                <h4>{t}</h4>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SOLUCIÓN */}
      <section className="solution" id="beneficios">
        <div className="lp-container">
          <div className="solution-header">
            <div className="section-label">La solución</div>
            <h2>Todo lo que necesitas<br />en un solo sistema</h2>
            <p>Marketing MAP combina IA, automatización y psicología de ventas para que ningún cliente potencial se te escape.</p>
          </div>
          <div className="features-grid">
            {[
              { bg: '#eef2ff', ico: '🤖', t: 'Respuesta automática en segundos', d: 'La IA responde WhatsApp, Instagram y email de forma natural y personalizada, 24 horas al día, 7 días a la semana. Nunca más un lead sin respuesta.' },
              { bg: '#f0fdf4', ico: '🧠', t: 'Calificación inteligente de leads', d: 'El sistema analiza cada conversación y asigna un score de probabilidad de compra. Tu equipo solo se enfoca en los prospectos listos para cerrar.' },
              { bg: '#fff7ed', ico: '🎯', t: 'Prospección activa automática', d: 'Marketing MAP busca prospectos en tus bases de datos y los contacta de forma natural, con mensajes personalizados según su perfil y sector.' },
              { bg: '#fdf4ff', ico: '🔁', t: 'Seguimiento que no olvida', d: 'Secuencias automatizadas de follow-up en el canal correcto, en el momento correcto. El sistema no descansa, no se olvida y no se cansa.' },
              { bg: '#f0f9ff', ico: '📊', t: 'Panel en tiempo real', d: 'Ve todo lo que pasa: de dónde vienen tus leads, qué les interesa, cuántos se convierten y cuánto vale cada canal de captación.' },
              { bg: '#fef2f2', ico: '🔒', t: 'Cumplimiento legal (LOPDP)', d: 'Gestión de consentimientos, bajas automáticas y protección de datos conforme a la Ley Orgánica de Protección de Datos del Ecuador.' },
            ].map(({ bg, ico, t, d }) => (
              <div key={t} className="feat">
                <div className="feat-icon" style={{ background: bg }}>{ico}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="how" id="como-funciona">
        <div className="lp-container">
          <div className="how-header">
            <div className="section-label">Proceso</div>
            <h2>En 3 pasos tu negocio<br />trabaja solo</h2>
          </div>
          <div className="steps">
            {[
              { n: '1', t: 'Llega el lead', d: 'Un cliente escribe por WhatsApp, Instagram, formulario web o cualquier canal. El sistema lo captura al instante.' },
              { n: '2', t: 'La IA responde y califica', d: 'En segundos, la IA responde de forma personalizada, detecta el interés, el perfil psicológico y la etapa de compra.' },
              { n: '3', t: 'Seguimiento automático', d: 'El sistema da seguimiento solo hasta cerrar la venta. Tú recibes el lead listo para firmar.' },
            ].map(({ n, t, d }) => (
              <div key={n} className="step">
                <div className="step-num">{n}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RESULTADOS */}
      <section className="results">
        <div className="lp-container">
          <div className="results-header">
            <div className="section-label" style={{ color: '#818cf8' }}>Resultados</div>
            <h2>Lo que cambia cuando<br />automatizas tu captación</h2>
            <p>Números reales de negocios que implementaron Marketing MAP en Ecuador.</p>
          </div>
          <div className="results-grid">
            <div className="result-card">
              <div className="num gradient-text">+340%</div>
              <div className="lbl">Más leads atendidos<br />con el mismo equipo</div>
            </div>
            <div className="result-card">
              <div className="num" style={{ color: '#22c55e' }}>-87%</div>
              <div className="lbl">Reducción en tiempo<br />de respuesta promedio</div>
            </div>
            <div className="result-card">
              <div className="num" style={{ color: '#f59e0b' }}>3.2x</div>
              <div className="lbl">Más conversiones<br />de lead a cliente</div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIO */}
      <section className="testimonial">
        <div className="lp-container">
          <div className="test-card">
            <div className="stars">⭐⭐⭐⭐⭐</div>
            <blockquote>
              "Antes perdíamos leads porque no podíamos responder rápido los fines de semana.
              Ahora Marketing MAP atiende todo solo y ya en el primer mes recuperamos 3 veces
              lo que invertimos."
            </blockquote>
            <div className="test-author">
              <strong>Carlos Mejía</strong>
              Gerente Comercial · Empresa de Servicios Empresariales, Quito
            </div>
          </div>
        </div>
      </section>

      {/* CONTACTO */}
      <section className="contact" id="contacto">
        <div className="lp-container">
          <div className="contact-grid">
            <div className="contact-left">
              <div className="section-label">Empieza hoy</div>
              <h2>Hablemos de tu negocio.<br />Sin compromiso.</h2>
              <p>Un asesor te contactará hoy mismo para mostrarte cómo Marketing MAP puede funcionar para tu empresa específica.</p>
              {[
                'Demo personalizada gratuita',
                'Sin contratos de permanencia',
                'Implementación en 48 horas',
                'Soporte en español con tu equipo',
                'Compatible con WhatsApp Business',
              ].map((f) => (
                <div key={f} className="contact-feature">
                  <span className="ck">✓</span> {f}
                </div>
              ))}
            </div>

            <div className="form-card">
              <div id="form-view">
                <h3>Solicitar demo gratuita</h3>
                <p className="sub">Completa el formulario y te contactamos hoy.</p>
                <form id="lead-form">
                  <div className="form-row">
                    <div className="form-field">
                      <label htmlFor="lp-name">Nombre *</label>
                      <input id="lp-name" name="name" required placeholder="Tu nombre" />
                    </div>
                    <div className="form-field">
                      <label htmlFor="lp-company">Empresa</label>
                      <input id="lp-company" name="company" placeholder="Nombre de tu empresa" />
                    </div>
                  </div>
                  <div className="form-field">
                    <label htmlFor="lp-phone">WhatsApp / Teléfono *</label>
                    <input id="lp-phone" name="phone" type="tel" required placeholder="+593 99 999 9999" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="lp-email">Correo electrónico</label>
                    <input id="lp-email" name="email" type="email" placeholder="tucorreo@empresa.com" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="lp-message">¿En qué podemos ayudarte?</label>
                    <textarea id="lp-message" name="message" rows={3} placeholder="Cuéntanos brevemente tu situación actual…" />
                  </div>
                  <label className="consent-label">
                    <input type="checkbox" id="lp-consent" required />
                    <span>Autorizo que me contacten y acepto la <a href="/politica" target="_blank">política de privacidad</a>. Puedo solicitar mi baja en cualquier momento.</span>
                  </label>
                  <button type="submit" className="form-submit" id="submit-btn">
                    Quiero mi demo gratuita →
                  </button>
                  <p className="note">🔒 Datos protegidos conforme a la Ley de Protección de Datos (LOPDP)</p>
                </form>
              </div>

              <div id="ok-view" className="ok-view hidden">
                <div className="big">✅</div>
                <h3>¡Recibido!</h3>
                <p>Gracias por tu interés. Un asesor te contactará <strong>hoy mismo</strong> para mostrarte cómo Marketing MAP puede transformar tu captación de clientes. 🚀</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="lp-container">
          <div className="footer-grid">
            <div className="footer-brand">
              <div className="logo" style={{ marginBottom: 12 }}>
                <div className="logo-mark">m</div>
                <div>
                  <div className="logo-name">Marketing MAP</div>
                  <div className="logo-tag">Captación con IA</div>
                </div>
              </div>
              <p>Sistema de captación de clientes con Inteligencia Artificial, diseñado para empresas ecuatorianas. Automatiza, califica y convierte leads 24/7.</p>
            </div>
            <div className="footer-col">
              <h4>Producto</h4>
              <a href="#beneficios">Características</a>
              <a href="#como-funciona">Cómo funciona</a>
              <a href="#contacto">Demo gratuita</a>
            </div>
            <div className="footer-col">
              <h4>Legal</h4>
              <a href="/politica">Política de privacidad</a>
              <a href="/politica">Términos de uso</a>
              <a href="/politica">Cumplimiento LOPDP</a>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2025 Marketing MAP · JOMAP Consultores · Todos los derechos reservados</span>
            <span>Hecho en Ecuador 🇪🇨 · Con Inteligencia Artificial</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
