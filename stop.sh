#!/bin/bash

export COMPOSE_PROJECT_NAME=telemarketing

echo "🛑 Остановка проекта..."
docker compose down
echo "✅ Проект остановлен"
