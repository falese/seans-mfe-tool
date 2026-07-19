# abc-kids control-plane registry (ported from falese/daemon component-system).
# Resolution rules + MFE registrations: answers the daemon's resolve calls and
# accepts registrations on :4000 (register-games.sh posts here).
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev --no-audit --no-fund

# Copy source code
COPY simple-registry.js ./

# Listen on 4000 by default (overridable via PORT).
EXPOSE 4000

# Start the registry
CMD ["node", "simple-registry.js"]
