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

Migrations run automatically on startup. Take a backup first when a deploy
contains one — see [Backups](#backups) below; the nightly timer may be up to
24 hours stale:

```bash
/srv/bustbudget/backup-bustbudget.sh
```

To roll back to a specific build, set `BUSTBUDGET_TAG` in `.env` to a tag CI
published (`sha-<short>`, a branch name, or a `v*` version) and `up -d` again.

## Backups

`scripts/backup-bustbudget.sh` backs up the containerised database. Deployed
copy lives at `/srv/bustbudget/backup-bustbudget.sh`, next to
`docker-compose.yml`, and finds the database relative to its own location, so
it runs correctly from any working directory — including from systemd.

Backups land in `/mnt/storage/bustbudget_backups` as
`budget_<timestamp>_<image tag>-<image digest>.db`, for example
`budget_20260919_093144_latest-36a9c83d1d8d.db`. The image identifier replaces
the git revision the old script read from a checkout, which production no
longer has.

It uses sqlite3's online `.backup` rather than `cp`: the database runs in WAL
mode and the container writes to it continuously, so a plain copy can capture
a torn file whose `-wal` tail is missing. Each result is checked with
`PRAGMA integrity_check` and discarded if it fails, and is written under a
temporary name and renamed on success, so an interrupted run cannot leave a
half-written file that looks like a good backup.

Retention is 30 days with a floor of 7 copies, so a long outage cannot quietly
expire everything you have.

`scripts/backup-db.sh` is the older script. It still works against a
development checkout's `server/data/budget.db`, and is not the production
path.

### Install

`/mnt/storage` is root-owned, so create the destination once. The script exits
with these instructions rather than guessing:

```bash
sudo mkdir -p /mnt/storage/bustbudget_backups
sudo chown snikanes:snikanes /mnt/storage/bustbudget_backups
```

```bash
cp scripts/backup-bustbudget.sh /srv/bustbudget/
chmod +x /srv/bustbudget/backup-bustbudget.sh
/srv/bustbudget/backup-bustbudget.sh          # try it once
```

### Schedule it

The units in `deploy/systemd/` run it daily. They are system units rather than
user units because a user timer only runs while you have a session open,
unless you enable lingering. `User=snikanes` in the service keeps it running
as you, with your access to `/srv/bustbudget/data` and the backup directory.

```bash
sudo cp deploy/systemd/bustbudget-backup.service /etc/systemd/system/
sudo cp deploy/systemd/bustbudget-backup.timer   /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now bustbudget-backup.timer
```

**`enable`, not just `start`.** `start` activates the timer for the current
boot only; `enable` creates the `timers.target.wants` symlink that systemd
reads at boot. A timer that was only started looks healthy —
`is-active=active`, a plausible next run in `list-timers` — and disappears at
the next reboot with no error anywhere. Verify with:

```bash
systemctl is-enabled bustbudget-backup.timer    # want: enabled
systemctl list-timers bustbudget-backup.timer   # next and last run
journalctl -u bustbudget-backup.service -n 20   # output of the last run
```

Enable the timer, not the service: the service is `Type=oneshot` with no
`[Install]` section, and reports `is-enabled=static` by design.

To watch the timer actually fire, temporarily set `OnCalendar=*:0/2` and
`RandomizedDelaySec=0`, `daemon-reload`, then revert. `systemctl start
bustbudget-backup.service` runs it once immediately, under the same user and
environment systemd will use — which a manual shell invocation does not prove.

### Restoring

```bash
cd /srv/bustbudget
docker compose stop
cp /mnt/storage/bustbudget_backups/budget_<stamp>_<image>.db data/budget.db
rm -f data/budget.db-wal data/budget.db-shm    # stale relative to the restored file
chown 1000:1000 data/budget.db
docker compose start
```

### Settings

All overridable by environment variable:

| Variable | Default |
| --- | --- |
| `BUSTBUDGET_BACKUP_DIR` | `/mnt/storage/bustbudget_backups` |
| `BUSTBUDGET_DB` | `<script dir>/data/budget.db` |
| `BUSTBUDGET_CONTAINER` | `bustbudget` |
| `BUSTBUDGET_RETENTION_DAYS` | `30` |
| `BUSTBUDGET_KEEP_MIN` | `7` |

`.env` is not backed up. It holds `JWT_SECRET`; losing it logs everyone out
but loses no data.

Both `sqlite3` calls in the script pass `-init /dev/null` to skip `~/.sqliterc`,
which on this host sets `.headers on` — without it the integrity check reads
the column name instead of the value and every backup is rejected.

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

Do not copy `server/.env` across wholesale. It is written for local
development, and compose's `env_file` overrides the image's own defaults — in
particular `NODE_ENV=development` would clear the `Secure` flag on auth
cookies on an HTTPS site.


| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `3001` | |
| `DATABASE_PATH` | `/config/budget.db` | Inside the container |
| `JWT_SECRET` | dev fallback | **Set this in production** |
| `JWT_ACCESS_TOKEN_EXPIRY` | `1d` | Give it a unit (`15m`, `1d`); a bare number means seconds |
| `GOOGLE_CLIENT_ID` | — | Server-side id token verification |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Only needed when the client is served from another origin |
| `CLIENT_DIST_PATH` | `../../client/dist` relative to the server | |
| `PUID` / `PGID` | `1000` | Ownership of `/config`, as in the *arr images |
| `TZ` | `Europe/Oslo` | |
| `UMASK_SET` | `022` | |
