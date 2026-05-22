# abc-kids-multiplication-quiz
# Angular/webpack MFE + BFF
# Build context: repo root (needed to include src/runtime/ source)

# ── Stage 1: Install seans-mfe-tool CLI ──────────────────────────────────────
# scripts/generate-mfe.js uses ts-node --transpileOnly, so we only need
# npm install here — no tsc, no workspace packages required.
FROM node:20-slim AS cli-builder

WORKDIR /seans-mfe-tool
COPY package*.json ./
COPY tsconfig.json ./
RUN npm install --prefer-offline --no-audit --no-fund
COPY src/ ./src/
COPY packages/ ./packages/
COPY scripts/ ./scripts/

# ── Stage 2: Build the MFE ───────────────────────────────────────────────────
FROM node:20-slim AS builder

COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
ENV SEANS_MFE_SCRIPT=/seans-mfe-tool/scripts/generate-mfe.js

WORKDIR /app

# Copy runtime source BEFORE npm install so file:../../../src/runtime resolves
COPY src/runtime/ /src/runtime/

# Angular 17 peer deps require --legacy-peer-deps
COPY examples/abc-kids/multiplication-quiz/package*.json ./
RUN npm install --legacy-peer-deps --prefer-offline --no-audit --no-fund

# Copy source
COPY examples/abc-kids/multiplication-quiz/ .

# Regenerate platform code from mfe-manifest.yaml, build Angular bundle + Mesh
RUN node $SEANS_MFE_SCRIPT
RUN npm run build

# Compile server.ts → server.js for production runtime
RUN npm run build:server

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Runtime source needed for file:../../../src/runtime dep in production install
COPY src/runtime/ /src/runtime/
COPY --from=builder /app/package*.json ./
RUN npm install --legacy-peer-deps --omit=dev --prefer-offline --no-audit --no-fund

COPY --from=builder /app/.mesh ./.mesh
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3003/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs meshuser
USER meshuser

ENV PORT=3003
EXPOSE 3003

CMD ["node", "server.js"]

