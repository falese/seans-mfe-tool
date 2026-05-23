# abc-kids-multiplication-quiz
# Angular/webpack MFE + BFF
# Build context: examples/abc-kids/multiplication-quiz/

# Build tools stage — provides seans-mfe-tool CLI and pre-compiled runtime
FROM seans-mfe-tool-cli:latest AS cli-builder

# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

WORKDIR /app

# Make pre-compiled runtime available via file: reference.
# dist/runtime has compiled .js + .d.ts — no source traversal, no transitive deps.
COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
RUN chmod +x /seans-mfe-tool/bin/run.js && \
    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool

# Install dependencies.
# Override @seans-mfe-tool/runtime to the compiled dist package so ng build
# resolves .d.ts files only (no zod/dsl/schema traversal).
COPY package.json ./
RUN npm pkg set devDependencies['@seans-mfe-tool/runtime']='file:/seans-mfe-tool/dist/runtime'
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy source
COPY . .

# Regenerate platform code from mfe-manifest.yaml, then build Angular bundle
# (mesh build is included via shell conditional when data: section is present)
RUN seans-mfe-tool remote:generate
RUN npm run build

# Compile server.ts → server.js for production runtime
RUN npm run build:server

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-slim AS production

WORKDIR /app

# Use builder's package.json (npm pkg set moved runtime to devDep)
# so --omit=dev skips @seans-mfe-tool/runtime entirely
COPY --from=builder /app/package.json ./
RUN npm install --omit=dev --legacy-peer-deps --no-audit --no-fund

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
