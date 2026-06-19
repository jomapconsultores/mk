# Conectar WhatsApp (Fase 2)

El backend ya tiene todo listo para WhatsApp (webhook + envío + IA + baja). Solo falta
crear la app en Meta y darme 2 datos. Estos son los pasos.

## Datos que ya dejé listos

- **Callback URL (webhook):** `https://marketing-map-backend.onrender.com/webhooks/whatsapp`
- **Verify token:** `d4423a38fcb055efaa69ade41a9ce4b9`  (ya está puesto en el backend)

## Pasos en Meta (tú)

1. Entra a [developers.facebook.com](https://developers.facebook.com) → **My Apps** → **Create App**.
2. Tipo de app: **Business**. Ponle nombre (ej. "marketing-map").
3. En el panel de la app, agrega el producto **WhatsApp** (botón "Set up").
4. Te dará un **número de prueba** y verás:
   - **Temporary access token** → este es `WHATSAPP_TOKEN` (dura 24h; luego generamos uno permanente).
   - **Phone number ID** → este es `WHATSAPP_PHONE_ID`.
5. Configura el **webhook**:
   - En WhatsApp → **Configuration** → **Edit** en Webhook.
   - **Callback URL:** `https://marketing-map-backend.onrender.com/webhooks/whatsapp`
   - **Verify token:** `d4423a38fcb055efaa69ade41a9ce4b9`
   - Guarda. Debe decir verificado ✅.
   - En **Webhook fields**, suscríbete a **messages**.
6. En "API Setup", agrega tu propio número de celular como destinatario de prueba
   (Meta exige verificar los números en modo prueba).

## Lo que me das a mí

Pásame estos dos (yo los pongo en Render y probamos):
- `WHATSAPP_TOKEN` (el temporary access token)
- `WHATSAPP_PHONE_ID`

## Después (yo)

- Pongo las 2 variables en el backend (Render) por API.
- Probamos: te escribes a ti mismo al número de prueba y el sistema responde con IA,
  clasifica el lead y, si dices "STOP", te da de baja.

## Para producción (más adelante)

- El token temporal dura 24h. Para uso real se crea un **System User** con token
  permanente, y se solicita la verificación del negocio + un número propio.
- Mensajes fuera de la ventana de 24h requieren **plantillas aprobadas** por Meta.
