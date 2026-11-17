# Puppeteer Mobile — run anywhere (Render, Railway, VPS, home server).
FROM node:22-bookworm-slim

WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer \
    NODE_ENV=production

COPY package.json package-lock.json ./
# Same approach as the repository's official docker/Dockerfile: let
# Puppeteer install Chrome plus exactly the system libraries it needs.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates unzip fonts-liberation fonts-noto-color-emoji \
    && PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev --no-audit --no-fund \
    && npx puppeteer browsers install chrome --install-deps \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY . .

ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "server.js"]
