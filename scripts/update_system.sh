#!/usr/bin/env bash
# ==============================================================================
# Starciti Fleet Desk - Production System Update & Safe Migration Script (POSIX)
# Performs pre-update backup, schema migration, container restart, health check,
# and automatic rollback on failure.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

NODE_ARGS=("$ROOT_DIR/scripts/update_production.cjs")

for arg in "$@"; do
  case "$arg" in
    --skip-backup) NODE_ARGS+=("--skip-backup") ;;
    --skip-build) NODE_ARGS+=("--skip-build") ;;
    --dry-run) NODE_ARGS+=("--dry-run") ;;
    *) ;;
  esac
done

node "${NODE_ARGS[@]}"
exit $?
