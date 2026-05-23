# abc-kids-flappy
# Static MFE - build with rspack, serve with nginx
# Build context: examples/abc-kids/flappy/

# Build tools stage - provides seans-mfe-tool CLI and pre-compiled runtime
FROM seans-mfe-tool-cli:latest AS cli-builder

# -- Build stage ---------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Make pre-compiled runtime available via file: reference.
# dist/runtime has compiled .js + .d.ts - no source traversal, no transitive deps.
COPY --from=cli-builder /seans-mfe-tool /seans-mfe-tool
RUN chmod +x /seans-mfe-tool/bin/run.js && \
    ln -sf /seans-mfe-tool/bin/run.js /usr/local/bin/seans-mfe-tool

# Install dependencies.
# Override @seans-mfe-tool/runtime to the compiled dist package.
COPY package.json ./
RUN npm pkg set devDependencies['@seans-mfe-tool/runtime']='file:/seans-mfe-tool/dist/runtime'
RUN npm install --no-audit --no-fund

# Copy source
COPY . .

# remote:generate is included in the rspack build script; also builds the bundle
RUN npm run build

# -- Production stage ----------------------------------------------------------
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3001
CMD ["nginx", "-g", "daemon off;"]
