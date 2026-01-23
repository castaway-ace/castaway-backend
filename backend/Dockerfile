# Development stage
FROM oven/bun:1 AS development

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install

# Copy source code
COPY . .

# Generate Prisma Client
RUN bunx prisma generate

# Expose port
EXPOSE 3000

# Start in development mode
CMD ["bun", "run", "start:dev"]


# Production stage
FROM oven/bun:1 AS production

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install only production dependencies
RUN bun install --production

# Copy built application from development stage
COPY --from=development /app/dist ./dist
COPY --from=development /app/node_modules/.prisma ./node_modules/.prisma

# Expose port
EXPOSE 3000

# Start in production mode
CMD ["bun", "run", "start:prod"]