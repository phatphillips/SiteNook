# Nuxt 4.4+ requires Node 22+. pnpm handles native optional deps; lockfile may be refreshed in-container when package.json changes.
FROM node:22-bookworm-slim AS development
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --dangerously-allow-all-builds
COPY . .
EXPOSE 3000
CMD ["pnpm", "run", "dev", "--", "--host", "0.0.0.0"]

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.1.3 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile --dangerously-allow-all-builds
COPY . .
# Baked into the client bundle; nginx proxies /api → PocketBase in the default stack.
ARG NUXT_PUBLIC_POCKETBASE_URL=/api
ARG NUXT_PUBLIC_APP_URL=http://localhost
ENV NUXT_PUBLIC_POCKETBASE_URL=$NUXT_PUBLIC_POCKETBASE_URL \
    NUXT_PUBLIC_APP_URL=$NUXT_PUBLIC_APP_URL \
    NUXT_TELEMETRY_DISABLED=1 \
    NITRO_SOURCEMAP=false \
    NODE_OPTIONS=--max-old-space-size=8192
RUN pnpm run build

FROM node:22-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
