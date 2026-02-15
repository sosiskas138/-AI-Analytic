#!/bin/bash
set -a
[ -f .env ] && source .env
set +a
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-telemarketing}

echo "🔄 Перезапуск контейнеров..."
docker compose restart

echo "✅ Готово"
