# syntax=docker/dockerfile:1

# ---- deps: instala node_modules com cache de camada isolado ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compila o Next.js (output: "standalone") ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# DATABASE_URL não precisa existir no build; só é lido em runtime.
RUN npm run build

# ---- runner: imagem final, só com o server standalone traçado ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# content/pdfs, content/materials e content/videos são normalmente montados como
# volume (docker-compose), mas garantem os diretórios existirem mesmo em
# `docker run` sem volume.
RUN mkdir -p content/pdfs content/materials content/videos && chown -R nextjs:nodejs content

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
