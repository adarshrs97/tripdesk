#!/usr/bin/env bash
# ==============================================================================
# Starciti Fleet Desk - Production Release Packaging Script (Bash / POSIX)
# Builds production web assets and tags production Nginx Docker container.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

echo "=================================================================="
echo " STARCITI FLEET DESK: PRODUCTION RELEASE BUILD"
echo "=================================================================="

# 1. Determine Version
VERSION="${1:-}"
if [ -z "$VERSION" ]; then
  VERSION=$(node -p "require('./package.json').version")
fi

echo "[1/4] Target Release Version: v$VERSION"

# 2. Run clean frontend build
echo "[2/4] Compiling frontend (npm run build)..."
npm run build

if [ ! -f "$ROOT_DIR/dist/index.html" ]; then
  echo "[ERROR] dist/index.html not found after build!"
  exit 1
fi
echo "      Frontend build succeeded."

# 3. Create Release Manifest
cat <<EOF > "$ROOT_DIR/dist/release-manifest.json"
{
  "version": "$VERSION",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "app": "Starciti Fleet Desk",
  "dockerImage": "starciti-fleet-frontend:v$VERSION",
  "dockerLatest": "starciti-fleet-frontend:latest"
}
EOF
echo "      Release manifest written to dist/release-manifest.json"

# 4. Build Docker Production Container
if [ "${SKIP_DOCKER:-false}" = "true" ]; then
  echo "[3/4] Skipping Docker image build (SKIP_DOCKER=true)."
else
  echo "[3/4] Building production Docker container..."
  docker build -t "starciti-fleet-frontend:v$VERSION" -t "starciti-fleet-frontend:latest" -f "$ROOT_DIR/docker/nginx/Dockerfile" "$ROOT_DIR"
  echo "      Docker image built successfully."
fi

# 5. Summary
echo "[4/4] Release Verification Summary"
if [ "${SKIP_DOCKER:-false}" != "true" ]; then
  docker images "starciti-fleet-frontend:v$VERSION" --format "{{.Repository}}:{{.Tag}} (Size: {{.Size}}, ID: {{.ID}})"
fi

echo "=================================================================="
echo " RELEASE v$VERSION PACKAGED SUCCESSFULLY!"
echo "=================================================================="
exit 0
