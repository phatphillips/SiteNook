# Nuxt 4.4+ requires Node 22+. pnpm handles native optional deps; lockfile may be refreshed in-container when package.json changes.
FROM node:22-bookworm-slim AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --dangerously-allow-all-builds
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:22-bookworm-slim AS production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --dangerously-allow-all-builds
COPY . .
RUN pnpm run build
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
