# abc-kids-multiplication-quiz
# Angular/webpack MFE + BFF
# Build context: repo root (needed to include src/runtime/ source)

# ── Stage 1: CLI image (pre-built separately via Dockerfile.cli) ──────────────
FROM seans-mfe-tool-cli:latest AS cli-builder

# ── Stage 2: Build the MFE ───────────────────────────────────────────────────
FROM node:20-slim AS builder

COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
RUN chmod +x /seans-mfe-tool/bin/run.js && \
    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool

WORKDIR /app

# Copy runtime source BEFORE npm install so file:../../../src/runtime resolves
COPY src/runtime/ /src/runtime/

# Angular 17 peer deps require --legacy-peer-deps
# Copy only package.json — the lock file contains a "link":true symlink entry
# for @seans-mfe-tool/runtime that triggers an npm 10 bug with --legacy-peer-deps.
COPY examples/abc-kids/multiplication-quiz/package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source
COPY examples/abc-kids/multiplication-quiz/ .

# Regenerate platform code from mfe-manifest.yaml, then build Angular bundle + Mesh
RUN seans-mfe-tool remote:generate
RUN npm run build

# Compile server.ts → server.js for production runtime
RUN npm run build:server

# ── Stage 3: Production ───────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Runtime source needed for file:../../../src/runtime dep in production install
COPY src/runtime/ /src/runtime/
COPY --from=builder /app/package*.json ./
RUN npm install --legacy-peer-deps --omit=dev --no-audit --no-fund

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

