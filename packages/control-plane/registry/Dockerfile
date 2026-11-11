# syntax=docker/dockerfile:1
# Platform control-plane registry (PDR-008, ADR-078) — fleet-agnostic.
# Resolution rules + MFE registrations: answers the daemon's resolve calls and
# accepts registrations on :4000 (each fleet's register-*.sh posts here).
#
# Build context is this directory, so a fleet's compose file points at
# ../../packages/control-plane/registry rather than carrying its own copy.
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --omit=dev --no-audit --no-fund

# Copy source code. Glob, not a named file: the registry was split into
# simple-registry.js + slot-target.js (ADR-073 §5), and a single-file COPY
# silently ships an image that dies on ERR_MODULE_NOT_FOUND the moment a
# module is extracted. .dockerignore already keeps node_modules out.
COPY *.js ./

# Listen on 4000 by default (overridable via PORT).
EXPOSE 4000

# Start the registry
# The service needs nothing root has: it reads its own files and listens on a
# high port. `node` is the unprivileged user the base image ships.
USER node

CMD ["node", "simple-registry.js"]
