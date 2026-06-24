# Stage 1: backend deps
FROM --platform=linux/amd64 oven/bun:1 AS backend-deps

WORKDIR /app

COPY package.json bun.lockb* ./
RUN bun install --production

# Stage 2: frontend build
FROM --platform=linux/amd64 oven/bun:1 AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/bun.lockb* ./
RUN bun install
COPY frontend/ .
RUN bun run build

# Stage 3: runtime
FROM --platform=linux/amd64 oven/bun:1-slim

WORKDIR /app

COPY --from=backend-deps /app/node_modules ./node_modules
COPY agent/ ./agent/
COPY package.json ./
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

RUN mkdir -p /data && chown -R bun:bun /app /data
USER bun

EXPOSE 80

CMD ["bun", "run", "agent/index.ts"]
