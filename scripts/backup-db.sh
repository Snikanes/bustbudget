#!/bin/bash

# Database Backup Script
# Creates a backup of the SQLite database with git revision and timestamp

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DB_PATH="$PROJECT_ROOT/server/data/budget.db"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Get git revision of main branch
GIT_REV=$(git -C "$PROJECT_ROOT" rev-parse --short main)

# Create timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if database exists
if [ ! -f "$DB_PATH" ]; then
    echo "Error: Database not found at $DB_PATH"
    exit 1
fi

# Create backup filename
BACKUP_FILE="$BACKUP_DIR/budget_${TIMESTAMP}_${GIT_REV}.db"

# Copy database
cp "$DB_PATH" "$BACKUP_FILE"

echo "Backup created: $BACKUP_FILE"
echo "Git revision: $GIT_REV"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
