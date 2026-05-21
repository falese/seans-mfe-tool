# abc-kids-hockey
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

# Install MFE dependencies
COPY examples/abc-kids/hockey/package*.json ./
# Copy dist/runtime before npm install so the file:../../dist/runtime dep resolves
COPY dist/runtime/ /dist/runtime/
RUN npm install --prefer-offline --no-audit --no-fund

# Copy hockey source
COPY examples/abc-kids/hockey/ .

# Copy runtime source (resolved via @seans-mfe-tool/runtime alias in rspack.config.js)
COPY src/runtime/ /src/runtime/

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY examples/abc-kids/hockey/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3002
CMD ["nginx", "-g", "daemon off;"]
