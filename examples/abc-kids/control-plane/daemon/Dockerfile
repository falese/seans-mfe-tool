# abc-kids control-plane daemon (ported from falese/daemon component-system).
# Node control plane: forwards renderer actions to the registry and relays the
# resolved experience back. Listens on 3004 (3001–3003 belong to the MFEs).
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY simple-daemon.js ./

# Listen on 3004 by default (overridable via env); the shell's browser connects
# to ws://localhost:3004/graphql.
ENV DAEMON_PORT=3004
EXPOSE 3004

# Start the daemon
CMD ["node", "simple-daemon.js"]
