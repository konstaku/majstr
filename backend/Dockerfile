FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libdbus-1-3 libgtk-3-0 libgbm1 libasound2 \
    libxss1 libxtst6 libx11-6 libxcomposite1 libxcursor1 libxdamage1 \
    libxext6 libxfixes3 libxi6 libxkbcommon0 libxrandr2 libxrender1 \
    libxcb1 libpango-1.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

EXPOSE 5000
CMD ["node", "index.js"]
