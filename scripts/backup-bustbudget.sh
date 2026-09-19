#!/bin/bash

# BustBudget database backup
#
# Lives next to docker-compose.yml (i.e. /srv/bustbudget/backup-bustbudget.sh)
# and finds the database relative to itself, so it can be run from anywhere,
# including from cron or a systemd timer.
#
# Uses sqlite3's online .backup rather than cp: the database runs in WAL mode
# and the container writes to it continuously, so a plain copy can capture a
# torn file whose -wal tail is missing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

DB_PATH="${BUSTBUDGET_DB:-$SCRIPT_DIR/data/budget.db}"
BACKUP_DIR="${BUSTBUDGET_BACKUP_DIR:-/mnt/storage/bustbudget_backups}"
CONTAINER="${BUSTBUDGET_CONTAINER:-bustbudget}"

# Delete backups older than this, but never drop below KEEP_MIN of them, so a
# long outage cannot quietly expire every copy you have.
RETENTION_DAYS="${BUSTBUDGET_RETENTION_DAYS:-30}"
KEEP_MIN="${BUSTBUDGET_KEEP_MIN:-7}"

die() { echo "backup-bustbudget: $*" >&2; exit 1; }

# -init /dev/null skips ~/.sqliterc, which on this host sets `.headers on` and
# would prepend a column name to every value the script reads back.
sql() { sqlite3 -batch -noheader -init /dev/null "$@"; }

[ -f "$DB_PATH" ] || die "database not found at $DB_PATH"
command -v sqlite3 >/dev/null || die "sqlite3 is not installed (apt install sqlite3)"

if [ ! -d "$BACKUP_DIR" ]; then
    die "backup directory $BACKUP_DIR does not exist. Create it once with:
    sudo mkdir -p $BACKUP_DIR && sudo chown $(id -un):$(id -gn) $BACKUP_DIR"
fi
[ -w "$BACKUP_DIR" ] || die "backup directory $BACKUP_DIR is not writable by $(id -un)"

# Record which build produced the data, the way the old script recorded the
# git revision. There is no checkout to ask any more, so ask the container.
version="unknown"
if command -v docker >/dev/null && docker inspect "$CONTAINER" >/dev/null 2>&1; then
    image="$(docker inspect -f '{{.Config.Image}}' "$CONTAINER" 2>/dev/null || true)"
    digest="$(docker inspect -f '{{.Image}}' "$CONTAINER" 2>/dev/null | sed 's/^sha256://' | cut -c1-12)"
    tag="${image##*:}"
    [ -n "${tag:-}" ] && [ "$tag" != "$image" ] || tag="untagged"
    version="$(printf '%s-%s' "$tag" "${digest:-nodigest}" | tr -c 'A-Za-z0-9._-' '_')"
fi

timestamp="$(date +%Y%m%d_%H%M%S)"
target="$BACKUP_DIR/budget_${timestamp}_${version}.db"

# Write to a temporary name first so an interrupted run cannot leave a
# half-written file that looks like a good backup.
tmp="$(mktemp "$BACKUP_DIR/.budget_${timestamp}.XXXXXX")"
trap 'rm -f "$tmp"' EXIT

sql "$DB_PATH" ".backup '$tmp'"

check="$(sql "$tmp" 'PRAGMA integrity_check;' | head -1)"
[ "$check" = "ok" ] || die "integrity check failed on the new backup: $check"

mv "$tmp" "$target"
trap - EXIT
chmod 640 "$target"

echo "Backup created: $target"
echo "Image:          $version"
echo "Size:           $(du -h "$target" | cut -f1)"

# Prune, oldest first, stopping once KEEP_MIN would be breached.
mapfile -t backups < <(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'budget_*.db' -printf '%T@ %p\n' | sort -n | cut -d' ' -f2-)
count=${#backups[@]}
pruned=0
for file in "${backups[@]}"; do
    [ "$count" -le "$KEEP_MIN" ] && break
    if [ -n "$(find "$file" -maxdepth 0 -mtime +"$RETENTION_DAYS" -print -quit)" ]; then
        rm -f "$file"
        count=$((count - 1))
        pruned=$((pruned + 1))
    else
        # Sorted oldest first, so nothing after this is old enough either.
        break
    fi
done

echo "Retained:       $count backup(s); pruned $pruned older than ${RETENTION_DAYS}d"
