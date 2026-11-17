# Puppeteer Mobile — run anywhere (VPS, Render, Railway, home server).
FROM node:22-bookworm-slim

# System libraries Chrome needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation fonts-noto-color-emoji \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 \
      libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libxcomposite1 \
      libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npx puppeteer browsers install chrome
COPY . .

ENV PORT=3000 HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "server.js"]
