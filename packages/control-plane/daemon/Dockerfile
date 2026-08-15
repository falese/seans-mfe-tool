# syntax=docker/dockerfile:1
# Platform control-plane daemon (PDR-008, ADR-078) — fleet-agnostic.
# Node control plane: forwards renderer actions to the registry and relays the
# resolved experience back. Defaults to 3004; each fleet overrides DAEMON_PORT
# (abc-kids keeps 3004, meridian uses 4504).
#
# Build context is this directory, so a fleet's compose file points at
# ../../packages/control-plane/daemon rather than carrying its own copy.
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY simple-daemon.js ./

# Listen on 3004 by default (overridable via env); the shell's browser connects
# to ws://localhost:3004/graphql.
ENV DAEMON_PORT=3004
EXPOSE 3004

# Start the daemon
CMD ["node", "simple-daemon.js"]
