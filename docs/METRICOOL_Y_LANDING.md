# Metricool + Landing de captura

Estrategia de la **Fase 1** (sin WhatsApp todavía): Metricool **atrae** (contenido + anuncios)
y la **landing page** convierte ese tráfico en leads dentro de tu CRM.

```
Metricool: publica contenido y corre anuncios
      │  (lleva tráfico con "link en bio" o botón del anuncio)
      ▼
  Landing (landing/index.html)  ──POST /capture──►  Backend  ──►  CRM + IA
                                                    crea, clasifica, da seguimiento
```

## 1. La landing page

Archivo: `landing/index.html`. Es una página independiente (HTML puro), funciona en cualquier
hosting. Captura nombre, WhatsApp/teléfono, email y mensaje.

**Antes de publicarla**, edita esta línea con la URL de tu backend ya desplegado:
```js
const BACKEND_URL = "http://localhost:3000";   // cámbialo por tu URL de Render
```

Dónde publicarla (gratis): Render (static site), Netlify, Vercel, o GitHub Pages.
Luego, en Metricool, pones ese enlace en tu "link en bio", en los botones de tus anuncios
y en tus publicaciones. Todo lead cae automáticamente en el CRM, clasificado por IA.

## 2. Cómo obtener la API de Metricool (tu pregunta)

> La API sirve para traer **analíticas** de redes y campañas a tu panel, y para **programar
> publicaciones** desde el sistema. NO trae los DMs/comentarios entrantes como leads.

**Requisito:** plan **Advanced** o **Custom** (los planes gratis/Starter no tienen API).

Pasos:
1. Entra a tu cuenta de Metricool.
2. Ve a **Account Settings** (Configuración de la cuenta) → pestaña **API**.
3. Copia tu **API access token**.
4. Para llamar a la API necesitas 3 cosas en cada petición:
   - Cabecera: `X-Mc-Auth: tu_token`
   - Parámetros en la URL: `userId` y `blogId` (el blogId identifica cada "marca"/cuenta).
5. Documentación oficial: https://app.metricool.com/resources/apidocs/index.html

Si confirmas que tienes plan Advanced y me pasas el token (de forma segura) + el blogId,
en la Fase 3 puedo agregar una página "Redes/Campañas" a tu panel con esas métricas.

## 3. Endpoint de captura (backend)

`POST /capture` — recibe JSON y crea el lead:
```json
{ "name": "...", "phone": "+593...", "email": "...", "message": "...", "interested_product": "..." }
```
Respuesta: `{ "ok": true, "contactId": "..." }`. Tiene CORS abierto para aceptar formularios
desde cualquier dominio. Requiere al menos email o teléfono.

Probado end-to-end ✅: un envío de formulario crea el contacto y la IA lo clasifica
(etapa, interés, score, intención y resumen) automáticamente.
