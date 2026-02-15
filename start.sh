#!/bin/bash
# Загрузить .env — все настройки (порты, пароли, JWT, CORS, VITE_API_URL и т.д.)
set -a
[ -f .env ] && source .env
set +a

export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-telemarketing}
export DOCKER_BUILDKIT=${DOCKER_BUILDKIT:-0}
export COMPOSE_DOCKER_CLI_BUILD=${COMPOSE_DOCKER_CLI_BUILD:-0}

echo "🚀 Сборка и запуск контейнеров..."
docker compose up -d --build

APP_PORT=${APP_PORT:-8080}
echo ""
echo "✅ Откройте в браузере: http://localhost:${APP_PORT}"
echo ""
echo "Логи: docker compose logs -f"
