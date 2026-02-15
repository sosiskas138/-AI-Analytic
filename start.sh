#!/bin/bash
# Имя проекта — иначе папка с кириллицей/пробелами ломает docker compose
export COMPOSE_PROJECT_NAME=telemarketing
# Классический builder (обход ошибки Buildx: "header key x-docker-expose-session-sharedkey contains non-printable ASCII")
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0

echo "🚀 Сборка и запуск контейнеров..."
docker compose up -d --build

echo ""
echo "✅ Откройте в браузере: http://localhost"
echo "   Логин: admin  Пароль: admin1"
echo ""
echo "Логи: docker compose logs -f"
