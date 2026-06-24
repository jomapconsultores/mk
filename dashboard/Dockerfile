# Dashboard Marketing MAP — Panel interno Next.js 14.
# Multi-stage: se compila con todas las deps y se ejecuta solo con las de producción.

# 1) Build
FROM node:20-alpine AS builder
WORKDIR /app

# IMPORTANTE: las variables NEXT_PUBLIC_* se incrustan en el bundle en build-time.
# En Coolify hay que declararlas como "Build Variable" para que lleguen a este ARG.
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=${NEXT_PUBLIC_BACKEND_URL}

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2) Runtime
FROM node:20-alpine AS runner
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
