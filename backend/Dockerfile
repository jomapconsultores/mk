# Backend Marketing MAP — API Fastify (Node/TS ejecutado con tsx, sin paso de build).
FROM node:20-alpine

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
EXPOSE 3000

# Healthcheck contra el endpoint /health que ya expone el server.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1 || exit 1

CMD ["npm", "run", "start"]
