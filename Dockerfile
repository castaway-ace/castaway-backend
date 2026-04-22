# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base

# Prisma requires openssl; libc6-compat addresses occasional musl native-module edge cases
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# ─── Development ─────────────────────────────────────────────────────────────
FROM base AS development

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

EXPOSE 3000

CMD ["npm", "run", "start:dev"]

# ─── Build ───────────────────────────────────────────────────────────────────
FROM base AS build

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npm run build
RUN npm prune --omit=dev

# ─── Production ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS production

RUN apk add --no-cache openssl libc6-compat wget

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/main"]
