FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

FROM base AS deps
RUN apk add --no-cache openssl
RUN npm ci --omit=dev
RUN npx prisma generate

FROM base AS builder
RUN apk add --no-cache openssl
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY worker ./worker
COPY docs ./docs
COPY prisma ./prisma
RUN npx prisma generate
RUN npm run build
RUN mkdir -p dist/src/modules/docs && cp docs/openapi.yaml dist/src/modules/docs/openapi.yaml

FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]

FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
CMD ["node", "dist/worker/worker.js"]
