# meridian-cargo-ops — MFE + GraphQL Mesh BFF, one deployable unit (ADR-046).
# server.js serves remoteEntry.js and /graphql together on port 5004.
# Pattern: examples/abc-kids/flappy/Dockerfile (React) / multiplication-quiz
# (Angular). Build seans-mfe-tool-cli:latest first (repo root:
# npm run build && npm run docker:build:cli).
# Build tools stage — provides the seans-mfe-tool CLI and pre-compiled runtime
FROM seans-mfe-tool-cli:latest AS cli-builder

FROM node:20-slim AS builder
WORKDIR /app

COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
RUN chmod +x /seans-mfe-tool/bin/run.js && \
    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool

# The runtime is staged from the CLI image as a REAL directory inside
# node_modules — module resolution must never leave the project (a file:
# symlink would resolve Angular/React imports from outside it).
COPY package.json ./
RUN npm pkg delete dependencies['@seans-mfe-tool/runtime'] 2>/dev/null || true && \
    npm pkg delete devDependencies['@seans-mfe-tool/runtime'] 2>/dev/null || true
RUN npm install --legacy-peer-deps --no-audit --no-fund
RUN mkdir -p node_modules/@seans-mfe-tool && \
    cp -r /seans-mfe-tool/dist/runtime node_modules/@seans-mfe-tool/runtime

COPY . .

# Bundle + mesh artifacts + compiled server.
RUN npm run build
RUN npx mesh build
RUN npm run build:server

# remote:generate (inside npm run build) may rewrite package.json with a
# file: runtime reference that does not exist in the production image.
RUN npm pkg delete dependencies['@seans-mfe-tool/runtime'] 2>/dev/null || true && \
    npm pkg delete devDependencies['@seans-mfe-tool/runtime'] 2>/dev/null || true

FROM node:20-slim AS production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/.mesh ./.mesh
COPY --from=builder /app/specs ./specs
COPY --from=builder /app/src/platform/bff/mesh-context.js ./src/platform/bff/
COPY --from=builder /app/src/platform/bff/mock-switch.js ./src/platform/bff/
COPY --from=builder /app/src/platform/bff/mocks.json ./src/platform/bff/
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 5004) + '/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 meshuser
USER meshuser

ENV PORT=5004
EXPOSE 5004

CMD ["node", "server.js"]
