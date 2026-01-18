FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Development image
FROM base AS dev
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["bun", "run", "--watch", "src/main.ts"]

# Production build
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun build src/main.ts --outdir ./dist --target node

# Production image
FROM base AS prod
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
CMD ["bun", "run", "dist/main.js"]