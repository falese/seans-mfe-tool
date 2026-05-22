# abc-kids-flappy
# Static MFE — build with rspack, serve with nginx
# Build context: repo root (needed to include src/runtime/ source)

# ── Stage 1: Install seans-mfe-tool CLI ──────────────────────────────────────
# scripts/generate-mfe.js uses ts-node --transpileOnly, so we only need
# npm install here — no tsc, no workspace packages required.
FROM node:20-alpine AS cli-builder

WORKDIR /seans-mfe-tool
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --prefer-offline --no-audit --no-fund
COPY src/ ./src/
COPY packages/ ./packages/
COPY scripts/ ./scripts/

# ── Stage 2: Build the MFE ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Bring the CLI source across; set env so npm run generate finds the script
COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
ENV SEANS_MFE_SCRIPT=/seans-mfe-tool/scripts/generate-mfe.js

WORKDIR /app

# Copy runtime source BEFORE npm install so file:../../../src/runtime resolves
COPY src/runtime/ /src/runtime/

# Install MFE dependencies
COPY examples/abc-kids/flappy/package*.json ./
RUN npm install --prefer-offline --no-audit --no-fund

# Copy flappy source
COPY examples/abc-kids/flappy/ .

# remote:generate regenerates src/platform/base-mfe/mfe.ts from mfe-manifest.yaml,
# then rspack bundles the result
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY examples/abc-kids/flappy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
