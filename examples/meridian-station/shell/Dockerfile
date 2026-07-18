# meridian-shell — daemon-driven layout host (ADR-055)
# Build context: this directory. The shell imports @seans-mfe-tool/runtime
# (LayoutManager), which is provided by the pre-built CLI image — the same
# pattern the MFE Dockerfiles use. Build seans-mfe-tool-cli:latest first:
#   npm run build && npm run docker:build:cli   (repo root)

# Build tools stage — provides the pre-compiled runtime package
FROM seans-mfe-tool-cli:latest AS cli-builder

FROM node:20-alpine AS builder
WORKDIR /app

# Make the pre-compiled runtime available at a stable path inside the image.
# dist/runtime ships compiled .js + .d.ts, so the shell build never traverses
# the runtime's TypeScript source or its transitive dev-time deps.
COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool

COPY package.json ./
# Point @seans-mfe-tool/runtime at the pre-compiled dist package (the local
# checkout uses file:../../../dist/runtime instead — see package.json).
RUN npm pkg set devDependencies['@seans-mfe-tool/runtime']='file:/seans-mfe-tool/dist/runtime' && \
    npm install --no-audit --no-fund
COPY . .

# Daemon control-plane endpoint baked into the bundle (rspack DefinePlugin).
ARG DAEMON_WS_URL=ws://localhost:4504/graphql
ENV DAEMON_WS_URL=${DAEMON_WS_URL}
RUN npm run build

# Unprivileged nginx: runs as a non-root user (uid 101). Listens on 5000 (>1024
# so a non-root process can bind it). See ADR-044.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5000
CMD ["nginx", "-g", "daemon off;"]
