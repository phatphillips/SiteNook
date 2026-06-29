FROM mcr.microsoft.com/playwright:v1.60.0-noble AS base
WORKDIR /app

FROM base AS development
COPY package.json package-lock.json* ./
COPY . .
# Dev deps install at container start into a named volume (see docker-compose.override.yml).
# Avoids Docker copying huge playwright node_modules from image layers on Windows.
CMD ["sh", "-c", "npm install && npm run dev"]

FROM base AS production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["npm", "start"]
