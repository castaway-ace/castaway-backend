   # Development stage
   FROM node:22-alpine AS development
   WORKDIR /usr/src/app
   COPY package*.json ./
   RUN npm ci
   COPY . .
   USER node

   # Build stage
   FROM node:22-alpine AS build
   WORKDIR /usr/src/app
   COPY package*.json ./
   COPY --from=development /usr/src/app/node_modules ./node_modules
   COPY . .

   COPY prisma ./prisma

   RUN npx prisma generate
   RUN npm run build
   ENV NODE_ENV production
   RUN npm ci --only=production && npm cache clean --force
   USER node

   # Production stage
   FROM node:22-alpine AS production
   WORKDIR /usr/src/app
   COPY --from=build /usr/src/app/node_modules ./node_modules
   COPY --from=build /usr/src/app/dist ./dist
   COPY --from=build /usr/src/app/prisma ./prisma
   COPY --from=build /usr/src/app/prisma.config.ts ./prisma.config.ts
   CMD ["node", "dist/main.js"]