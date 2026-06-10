# abc-kids-color-mixer
# Static MFE - build with rspack, serve with nginx
# Build context: examples/abc-kids/color-mixer/

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
# @seans-mfe-tool/runtime is removed from package.json before npm install;
# we then copy it as a real directory (not a symlink) into node_modules so
# that rspack/webpack module resolution stays within /app/node_modules.
COPY package.json ./
RUN npm pkg delete dependencies['@seans-mfe-tool/runtime'] 2>/dev/null || true && \
    npm pkg delete devDependencies['@seans-mfe-tool/runtime'] 2>/dev/null || true
RUN npm install --no-audit --no-fund

# Copy runtime as a real directory so module resolution stays within /app.
RUN mkdir -p node_modules/@seans-mfe-tool && \
    cp -r /seans-mfe-tool/dist/runtime node_modules/@seans-mfe-tool/runtime

# Copy source
COPY . .

# remote:generate is included in the rspack build script; also builds the bundle
RUN npm run build

# -- Production stage ----------------------------------------------------------
# Unprivileged nginx: runs as a non-root user (uid 101). Listens on 3008 (>1024
# so a non-root process can bind it). See ADR-044.
FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3008
CMD ["nginx", "-g", "daemon off;"]
