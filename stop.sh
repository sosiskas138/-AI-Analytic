#!/bin/bash

echo "🛑 Остановка проекта..."

docker-compose -p telemarketing down

echo "✅ Проект остановлен"
