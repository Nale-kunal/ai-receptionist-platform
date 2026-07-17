# ── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY frontend/package*.json ./

RUN npm ci

COPY frontend/ .

# Build Vite static bundle
RUN npm run build

# ── Stage 2: Runtime ────────────────────────────────────────────────────────
FROM nginx:alpine

# Copy built assets to Nginx html directory
COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# Copy custom Nginx configuration if needed (default is overridden in proxy,
# but a basic config for SPA routing is healthy)
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
