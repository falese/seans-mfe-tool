# abc-kids-hockey
# Static MFE — build with rspack, serve with nginx
# Build context: repo root (needed to include src/runtime/ source)

# ── Stage 1: CLI image (pre-built separately via Dockerfile.cli) ──────────────
FROM seans-mfe-tool-cli:latest AS cli-builder

# ── Stage 2: Build the MFE ───────────────────────────────────────────────────
FROM node:20-alpine AS builder

# Bring the CLI source across and wire the binary into PATH directly
COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
RUN chmod +x /seans-mfe-tool/bin/run.js && \
    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool

WORKDIR /app

# Copy runtime source BEFORE npm install so file:../../../src/runtime resolves
COPY src/runtime/ /src/runtime/
COPY src/dsl/ /src/dsl/

# Install MFE dependencies
# Copy only package.json — lock file has "link":true for @seans-mfe-tool/runtime
# which triggers an npm 10 bug ("extraneous" read on undefined).
COPY examples/abc-kids/hockey/package.json ./
RUN npm install --no-audit --no-fund

# Copy hockey source
COPY examples/abc-kids/hockey/ .

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY examples/abc-kids/hockey/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3002
CMD ["nginx", "-g", "daemon off;"]
