# Guía de inicio — poner el MVP a funcionar

Esto te lleva de cero a "WhatsApp responde solo y clasifica clientes".

## 1. Cuentas que necesitas crear (esto te toca a ti)

| Servicio | Para qué | Costo inicial |
|---|---|---|
| **Supabase** (supabase.com) | Base de datos del CRM | Gratis |
| **Anthropic** (console.anthropic.com) | La IA (Claude) que clasifica y responde | Pago por uso (centavos por mensaje) |
| **Meta for Developers** (developers.facebook.com) | WhatsApp Business Cloud API | Gratis para empezar |

> La aprobación de WhatsApp Business toma tiempo y la gestionas tú desde Meta. Mientras
> tanto, el sistema funciona en "modo prueba" con números de test que da Meta.

## 2. Crear la base de datos

1. Crea un proyecto en Supabase.
2. Abre **SQL Editor**, pega todo el contenido de [`db/schema.sql`](../db/schema.sql) y dale **Run**.
3. En **Project Settings → API** copia:
   - `Project URL` → `SUPABASE_URL`
   - `service_role key` (secreta) → `SUPABASE_SERVICE_KEY`

## 3. Configurar el backend

```bash
cd backend
cp .env.example .env      # en Windows PowerShell: copy .env.example .env
# edita .env y pega tus llaves (Supabase, Anthropic, WhatsApp)
npm install
npm run dev
```

Deberías ver: `Backend escuchando en puerto 3000`.
Prueba: abre http://localhost:3000/health → debe responder `{ "ok": true }`.

## 4. Conectar WhatsApp

1. En Meta for Developers crea una app tipo **Business** y agrega el producto **WhatsApp**.
2. Copia el `Token` temporal y el `Phone number ID` → ponlos en `.env`
   (`WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`).
3. Expón tu backend a internet para que Meta le pueda llegar. En desarrollo usa
   [ngrok](https://ngrok.com): `ngrok http 3000` → te da una URL pública `https://...`.
4. En la config del webhook de WhatsApp:
   - **Callback URL**: `https://TU-URL-NGROK/webhooks/whatsapp`
   - **Verify token**: el mismo valor que pusiste en `WHATSAPP_VERIFY_TOKEN`
   - Suscríbete al evento **messages**.
5. Envía un WhatsApp a tu número de prueba. El sistema:
   - crea el contacto, guarda el mensaje,
   - lo clasifica con IA (etapa, interés, score),
   - responde solo, y
   - si escribes "STOP" o "baja", lo da de baja y deja de escribirle.

## 5. Cargar tus productos

Para que la IA sepa "qué vender", agrega productos en la tabla `products` (por ahora
desde el SQL Editor de Supabase; en la Fase 2 lo harás desde el panel):

```sql
insert into products (name, description, price, currency, sales_brief) values
('Plan Premium', 'Suscripción mensual con soporte', 29.90, 'USD',
 'Beneficio clave: ahorra 5h/semana. Objeción común "es caro" -> ofrecer prueba de 7 días.');
```

## 6. Ver los datos

En Supabase → **Table Editor** ves `contacts`, `messages`, `events`, etc. en vivo.
El panel visual para tu equipo llega en la Fase 2.

---

### ¿Costos de la IA?
Cada mensaje usa Claude para clasificar y responder. Con el modelo configurado
(`claude-sonnet-4-6`) el costo por conversación es de centavos. Puedes bajar costos
usando `claude-haiku-4-5` para la clasificación si manejas mucho volumen.
