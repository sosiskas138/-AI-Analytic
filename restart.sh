#!/bin/bash
set -a
[ -f .env ] && source .env
set +a
export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-telemarketing}

# При деплое нового кода используйте: ./restart.sh deploy
if [ "$1" = "deploy" ]; then
  echo "🔨 Пересборка и запуск (деплой новой версии)..."
  docker compose up -d --build
else
  echo "🔄 Перезапуск контейнеров (без пересборки)..."
  docker compose restart
fi

echo "✅ Готово"
