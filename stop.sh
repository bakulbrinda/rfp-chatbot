#!/usr/bin/env bash
set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "Stopping iMocha Intelligence Hub..."

docker compose down

echo ""
echo "All services stopped."
echo ""
echo "Data volumes (postgres, qdrant, uploads) are preserved."
echo "To also remove volumes and wipe all data, run:"
echo "  docker compose down -v"
echo ""
