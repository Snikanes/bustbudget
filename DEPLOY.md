# Deploying BustBudget

The app ships as a single container image. It runs the Express server, which
serves both the API under `/api` and the compiled client bundle for every
other path. nginx on the host terminates TLS and proxies everything to
`127.0.0.1:3001`.

```
browser -> nginx (TLS, budget.bustbyte.no)
             /      -> 127.0.0.1:3001  (client bundle, SPA fallback)
             /api/  -> 127.0.0.1:3001  (Express API)

container bustbudget
  /config/budget.db   SQLite database (bind mount)
```

## One-time setup

### GitHub

CI builds the image and pushes it to `ghcr.io/<owner>/bustbudget`. The client
bundle needs the Google OAuth client id at build time, so add it as a
**repository variable** (Settings → Secrets and variables → Actions →
Variables):

| Name | Value |
| --- | --- |
| `GOOGLE_CLIENT_ID` | `<your-id>.apps.googleusercontent.com` |

A Google OAuth *client id* is public — it is visible in the shipped JavaScript
either way — so a variable rather than a secret is the honest storage. The
client *secret* is never used by this app.

Nothing else is needed: pushes to `main` authenticate to GHCR with the
built-in `GITHUB_TOKEN`.

### Host (jarvis)

```bash
mkdir -p /srv/bustbudget/data
cd /srv/bustbudget

# Fetch docker-compose.yml and .env.example from the repo, then:
cp .env.example .env
$EDITOR .env          # GHCR_OWNER, BUSTBUDGET_DATA, JWT_SECRET, GOOGLE_CLIENT_ID
```

Set `BUSTBUDGET_DATA=/srv/bustbudget/data` (or wherever you want the database
to live) and generate a real `JWT_SECRET`:

```bash
openssl rand -base64 32
```

Note: changing `JWT_SECRET` invalidates every issued token, so everyone has to
log in again.

### Use `docker compose`, not `docker-compose`

The host has both: the v2 plugin (`docker compose`) and the old Python v1
binary at `/usr/local/bin/docker-compose`. This file has no `version:` key, so
v1 falls back to Compose file format v1 — where the top level *is* the service
map — and fails with:

```
Unsupported config option for services: 'bustbudget'
```

That is v1 reading `services` as a service name. Every command below uses the
v2 plugin.

## Cutover from the current setup

Today the backend runs as `tsx watch src/index.ts` out of
`/home/snikanes/git/bustbudget`, and nginx serves the client from that
checkout's `client/dist`. Replacing both:

```bash
# 1. Stop the running dev server (the tsx watch process on port 3001)
pkill -f 'tsx watch src/index.ts'

# 2. Copy the live database across. SQLite is in WAL mode, so copy all three
#    files, or checkpoint first with:
#      sqlite3 .../budget.db "PRAGMA wal_checkpoint(TRUNCATE);"
cp /home/snikanes/git/bustbudget/server/data/budget.db* /srv/bustbudget/data/
chown -R 1000:1000 /srv/bustbudget/data

# 3. Start the container
cd /srv/bustbudget
docker compose pull
docker compose up -d
docker compose logs -f          # expect "No pending migrations." + "Server running"

# 4. Swap the nginx config (see deploy/nginx/budget-app.conf)
sudo cp deploy/nginx/budget-app.conf /etc/nginx/sites-available/budget-app
sudo nginx -t && sudo systemctl reload nginx
```

Keep a copy of the old nginx file first — reverting is `cp` back plus
`systemctl reload nginx`, and restarting `tsx watch` brings the old setup back
exactly as it was.

## Routine deploys

```bash
cd /srv/bustbudget
docker compose pull && docker compose up -d
```

Migrations run automatically on startup. Back the database up before a deploy
that contains a migration:

```bash
cp /srv/bustbudget/data/budget.db{,.$(date +%F)}
```

To roll back to a specific build, set `BUSTBUDGET_TAG` in `.env` to a tag CI
published (`sha-<short>`, a branch name, or a `v*` version) and `up -d` again.

## Local use

Uncomment the `build:` block in `docker-compose.yml` and run
`docker compose up --build`, or build the image directly:

```bash
docker build --build-arg VITE_GOOGLE_CLIENT_ID=<id> -t bustbudget .
docker run --rm -p 3001:3001 -e JWT_SECRET=dev -v "$PWD/data:/config" bustbudget
```

`npm run dev` is unaffected: the server only mounts the static handler when a
built `client/dist` exists, so Vite still owns the client in development.

## Environment variables

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3001` | |
| `DATABASE_PATH` | `/config/budget.db` | Inside the container |
| `JWT_SECRET` | dev fallback | **Set this in production** |
| `JWT_ACCESS_TOKEN_EXPIRY` | `1d` | |
| `GOOGLE_CLIENT_ID` | — | Server-side id token verification |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Only needed when the client is served from another origin |
| `CLIENT_DIST_PATH` | `../../client/dist` relative to the server | |
| `PUID` / `PGID` | `1000` | Ownership of `/config`, as in the *arr images |
| `TZ` | `Europe/Oslo` | |
| `UMASK_SET` | `022` | |
