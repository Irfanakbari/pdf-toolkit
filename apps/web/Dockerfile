FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@11.15.0 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --filter @pdf-toolkit/web... --frozen-lockfile

FROM deps AS build
COPY apps/web apps/web
ARG NEXT_PUBLIC_API_URL=/pdf-tools/backend
ARG API_PROXY_TARGET=http://api:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    API_PROXY_TARGET=$API_PROXY_TARGET
RUN pnpm --filter @pdf-toolkit/web build

FROM node:22-alpine AS runtime
RUN apk add --no-cache tini \
    && addgroup -S -g 1001 app \
    && adduser -S -u 1001 -G app app
WORKDIR /app
COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
USER app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
