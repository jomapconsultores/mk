# Dashboard Marketing MAP — Panel interno Next.js 14.
# Multi-stage: se compila con todas las deps y se ejecuta solo con las de producción.

# 1) Build
# Node 22: @supabase/supabase-js requiere WebSocket nativo (no disponible en Node 20).
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Runtime
FROM node:22-alpine AS runner
RUN apk add --no-cache ca-certificates
WORKDIR /app
ENV NODE_ENV=production
# Next.js "next start" respeta la variable PORT que inyecta Coolify (default 3000).
ENV PORT=3000

# Solo dependencias de producción.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Artefactos de build y estáticos.
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

# Se invoca next directamente (sin "-p 3001" del package.json) para honrar $PORT.
CMD ["node_modules/.bin/next", "start"]
