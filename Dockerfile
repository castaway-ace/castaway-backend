# ---- base: shared foundation ------------------------------------------------
FROM node:24-alpine AS base

WORKDIR /usr/src/app

RUN mkdir -p /mnt/data/castaway/tmp && chown -R node:node /mnt/data/castaway

# ---- deps: full dependency tree --------------------------------
FROM base AS deps

COPY package*.json ./
RUN npm ci

# ---- development ------------------------------------------------
FROM deps AS development

ENV NODE_ENV=development

COPY . .

CMD ["npm", "run", "start:dev"]

# ---- build: Prisma client + TypeScript compile ------------------------------
FROM deps AS build

COPY . .

RUN npx prisma generate && npm run build

# ---- prod-deps: runtime dependency tree only --------------------------------
FROM base AS prod-deps

COPY package*.json ./

RUN npm ci --omit=dev

# ---- production -------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production

COPY --from=prod-deps /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma
COPY --from=build /usr/src/app/prisma.config.ts ./

COPY package*.json ./

# Drop root privileges.
USER node

EXPOSE 3000

CMD ["node", "dist/src/main.js"]
