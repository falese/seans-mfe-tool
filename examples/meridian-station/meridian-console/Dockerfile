# meridian-console — static React MFE (no BFF); nginx serves dist/ on 5001.
# Pattern: examples/abc-kids/hockey/Dockerfile.
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

RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 5001
CMD ["nginx", "-g", "daemon off;"]
