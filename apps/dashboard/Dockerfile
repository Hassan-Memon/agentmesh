# Multi-stage build for the Next.js dashboard (standalone output).
# Build context is the repo root:  docker build -f apps/dashboard/Dockerfile -t agentmesh-dashboard .
# NEXT_PUBLIC_* values are inlined into the browser bundle at build time, hence the build arg.

FROM node:22-alpine AS deps
WORKDIR /app
COPY apps/dashboard/package.json apps/dashboard/package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS builder
ARG NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000
ENV NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/dashboard ./
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
