# ─── Base ────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/

# ─── Dependencies ─────────────────────────────────────────────────────────────
FROM base AS deps
RUN apk add --no-cache openssl
RUN npm ci --omit=dev
RUN npx prisma generate

# ─── Build ────────────────────────────────────────────────────────────────────
FROM base AS builder
RUN apk add --no-cache openssl
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
COPY worker ./worker
RUN npx prisma generate
RUN npm run build

# ─── API runtime ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS api
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL on Alpine
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

# Run migrations then start the API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/server.js"]

# ─── Worker runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL on Alpine
RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./

CMD ["node", "dist/worker/worker.js"]
