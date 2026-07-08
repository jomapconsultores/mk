# Backend Marketing MAP — API Fastify (Node/TS ejecutado con tsx, sin paso de build).
# Node 22: @supabase/supabase-js requiere WebSocket nativo (no disponible en Node 20).
FROM node:22-alpine

# Zona horaria y certificados (para llamadas HTTPS a Supabase/APIs externas).
RUN apk add --no-cache tzdata ca-certificates

WORKDIR /app

# Instala dependencias primero (mejor cacheo de capas).
# tsx (runtime de TS) está en "dependencies", así que --omit=dev es suficiente.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copia el código fuente.
COPY . .

# Coolify inyecta PORT; el server lo lee en config.ts (default 3000).
ENV NODE_ENV=production
ENV PORT=3000
# Zona horaria del negocio (Ecuador, UTC-5). Sin esto Node corre en UTC y los
# "quiet hours"/ventanas de envío (getHours()) se calculan mal → mensajes de
# madrugada. tzdata ya está instalado arriba.
ENV TZ=America/Guayaquil
EXPOSE 3000

# Healthcheck contra el endpoint /health que ya expone el server.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 || exit 1

CMD ["npm", "run", "start"]
