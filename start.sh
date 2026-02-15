#!/bin/bash
# Имя проекта — иначе папка с кириллицей/пробелами ломает docker compose
export COMPOSE_PROJECT_NAME=telemarketing
# Классический builder (обход ошибки Buildx)
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

# Загрузить .env (порты, пароли, JWT_SECRET, CORS, VITE_API_URL)
set -a
[ -f .env ] && source .env
set +a

echo "🚀 Сборка и запуск контейнеров..."
docker compose up -d --build

APP_PORT=${APP_PORT:-8080}
echo ""
echo "✅ Откройте в браузере: http://localhost:${APP_PORT}"
echo ""
echo "Логи: docker compose logs -f"
