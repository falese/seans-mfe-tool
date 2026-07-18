# Generated APIs don't ship a Dockerfile (yet) — this is the Meridian
# station-wide pattern, identical across all three APIs.
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
# mongodb-memory-server is only a dev fallback; never fetch its mongod
# binary inside an image build.
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src

# Seeding happens in-process at boot (SEED_DATA=true from compose), so the
# container comes up populated with the station dataset.
ENV NODE_ENV=development
CMD ["node", "src/index.js"]
