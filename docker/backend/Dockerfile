# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /usr/src/app

# Install build dependencies for native modules (like argon2)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy package configuration files
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Install all dependencies (including devDependencies for building)
RUN npm ci

# Copy the rest of the application files
COPY backend/ .

# Generate Prisma Client and compile Typescript code
RUN npm run prisma:generate
RUN npm run build

# Prune devDependencies to keep final image clean
RUN npm prune --production

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM node:20-slim

WORKDIR /usr/src/app

# Install runtime dependencies (Prisma needs openssl)
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Use non-root node user
USER node

# Copy compiled code and only production dependencies
COPY --chown=node:node --from=builder /usr/src/app/dist ./dist
COPY --chown=node:node --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=builder /usr/src/app/package*.json ./
COPY --chown=node:node --from=builder /usr/src/app/prisma ./prisma

# Environment variables defaults
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/index.js"]
