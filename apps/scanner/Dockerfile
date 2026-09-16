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
# Keep TypeScript tooling: full `tsc` currently fails on strict errors in this tree.
# Runtime uses tsx until the compile clean-up lands (same entry as local npm run dev).
RUN npm ci
COPY . .
CMD ["npx", "tsx", "src/index.ts"]
