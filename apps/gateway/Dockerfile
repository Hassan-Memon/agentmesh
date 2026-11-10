# Multi-stage build for the Nest gateway. Build context is the repo root so the proto is
# available:   docker build -f apps/gateway/Dockerfile -t agentmesh-gateway .

# ---- stage 1: install deps and compile TypeScript ------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app
COPY apps/gateway/package.json apps/gateway/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY apps/gateway/prisma ./prisma
RUN npx prisma generate
COPY apps/gateway/tsconfig.json apps/gateway/tsconfig.build.json apps/gateway/nest-cli.json ./
COPY apps/gateway/src ./src
RUN npm run build

# ---- stage 2: production deps only ----------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/gateway/package.json apps/gateway/package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY apps/gateway/prisma ./prisma
RUN npx prisma generate

# ---- stage 3: runtime -----------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production PROTO_PATH=/app/proto/agentmesh/v1/agent.proto
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=builder /app/dist ./dist
COPY apps/gateway/prisma ./prisma
COPY proto ./proto
USER node
EXPOSE 4000
# Apply pending migrations, then start. `prisma` is a production dependency for exactly this step.
CMD ["sh", "-c", "npx --no-install prisma migrate deploy && node dist/main.js"]
