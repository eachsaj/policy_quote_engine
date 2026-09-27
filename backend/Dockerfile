# PolicyQuote backend: multi-stage, Fargate-ready image (stateless, env-configured, stdout/stderr logs,
# GET /health with the active KB version). Runs locally only; never deployed.
# Build from the repo root so risk-kb.json is in the context:
#   docker build -f backend/Dockerfile -t policyquote-backend .

FROM node:22.23-alpine AS build
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/tsconfig.json backend/tsconfig.build.json ./
COPY backend/src ./src
RUN npm run build

FROM node:22.23-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    KB_PATH=/app/kb/risk-kb.json
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force && find node_modules -mindepth 1 -type d -empty -delete
COPY --from=build /app/dist ./dist
# Default KB baked in. docker-compose bind-mounts the repo root over /app/kb so live edits reach the container.
COPY risk-kb.json ./kb/risk-kb.json
USER node
EXPOSE 3000
# alpine has no curl: use Node's built-in fetch.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
