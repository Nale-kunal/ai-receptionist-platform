# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY voice-server/package*.json ./

# Install all dependencies (including devDependencies)
RUN npm ci

COPY voice-server/ .

# Compile TS code
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /usr/src/app

USER node

COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./

ENV PORT=5000
ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "dist/server.js"]
