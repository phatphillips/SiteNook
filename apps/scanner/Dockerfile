FROM mcr.microsoft.com/playwright:v1.60.0-noble AS base
WORKDIR /app

FROM base AS development
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
CMD ["npm", "run", "dev"]

FROM base AS production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
CMD ["npm", "start"]
