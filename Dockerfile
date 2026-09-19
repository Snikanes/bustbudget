# ---------------------------------------------------------------------------
# build: install workspace deps, compile the client bundle and the server
# ---------------------------------------------------------------------------
FROM node:22-alpine AS build

WORKDIR /app

# better-sqlite3 and sqlite3 are native modules with no musl prebuilds for
# every node/alpine combination, so the toolchain has to be present here.
RUN apk add --no-cache python3 make g++

# Copy manifests first so the dependency layer is cached independently of
# source changes. npm workspaces needs every workspace's package.json.
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm ci

COPY client ./client
COPY server ./server

# Vite inlines this at build time, so the value is baked into the bundle.
# A Google OAuth *client id* is public by design (it ships in the JS either
# way); the client secret is never involved here.
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Drop dev dependencies but keep the native modules compiled above.
RUN npm prune --omit=dev

# npm hoists everything to the root today; these keep the COPY below working
# if a version conflict ever forces a nested install.
RUN mkdir -p /app/server/node_modules /app/client/node_modules

# ---------------------------------------------------------------------------
# runtime
# ---------------------------------------------------------------------------
FROM node:22-alpine

# su-exec drops privileges after the entrypoint has fixed up ids; shadow
# provides usermod/groupmod for the PUID/PGID remap the *arr images use.
RUN apk add --no-cache su-exec shadow tini

WORKDIR /app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist

# tsc compiles .ts only — the umzug migrations and the sequelize-cli config
# are plain .js and never reach dist. Without this the server starts against
# an empty database and reports "No pending migrations".
COPY --from=build /app/server/src/db/migrations ./server/dist/db/migrations

# Served by Express itself; app.ts resolves ../../client/dist, which is the
# same relative path in this layout as in the source tree.
COPY --from=build /app/client/dist ./client/dist

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Same conventions as the linuxserver.io *arr containers on the same host.
ENV PUID=1000 \
    PGID=1000 \
    TZ=Europe/Oslo \
    UMASK_SET=022 \
    NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/config/budget.db

WORKDIR /app/server

VOLUME ["/config"]

EXPOSE 3001

# No curl in the image; node 22 has a global fetch.
HEALTHCHECK --interval=1m --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--", "docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
