# Single image: Hono API + built SPA (WEB_DIST). See docs/api.md / infra/README.md.
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter web build \
 && pnpm --filter api --prod deploy /out/api

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 WEB_DIST=/app/web
WORKDIR /app
COPY --from=build /out/api ./
COPY --from=build /repo/apps/web/dist ./web
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["./node_modules/.bin/tsx", "src/index.ts"]
