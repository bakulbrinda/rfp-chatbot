#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "Starting iMocha Intelligence Hub..."

# Ensure .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example to .env and fill in the values."
  exit 1
fi

# Pull latest images silently, then start
docker compose pull --quiet 2>/dev/null || true
docker compose up -d --build

echo ""
echo "Waiting for services to be healthy..."

# Wait for backend health endpoint (up to 60s)
for i in $(seq 1 30); do
  if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo ""
    echo "iMocha Intelligence Hub is running."
    echo ""
    echo "  Frontend : http://localhost:3000"
    echo "  Backend  : http://localhost:8000"
    echo "  API docs : http://localhost:8000/docs"
    echo ""
    echo "Default admin credentials:"
    echo "  Email    : admin@imocha.io"
    echo "  Password : (see ADMIN_PASSWORD in .env)"
    echo ""
    exit 0
  fi
  printf "."
  sleep 2
done

echo ""
echo "WARNING: Backend did not become healthy within 60s. Check logs:"
echo "  docker compose logs backend --tail=30"
exit 1
