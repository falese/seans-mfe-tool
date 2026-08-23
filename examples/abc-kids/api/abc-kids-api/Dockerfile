# syntax=docker/dockerfile:1
# ABC Kids Play API — players, scores, progression.
#
# Hand-written: @seans-mfe/plugin-api generates the service but not a container
# for it. ADR-044's hardening rules cover generated MFE images; the same
# principles are applied here by hand — non-root user, slim base, an explicit
# healthcheck, production install only.
#
# Build context: this directory.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=development \
    PORT=3101 \
    SEED_DATA=true

# The generated service syncs its schema on connect outside production and
# seeds when SEED_DATA=true, so the fleet comes up with data in one command.
# NODE_ENV stays development deliberately: this is a reference app, and a
# production image would migrate explicitly instead.

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# SQLite writes a file; give the non-root user somewhere to put it.
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 3101

HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:3101/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "src/index.js"]
