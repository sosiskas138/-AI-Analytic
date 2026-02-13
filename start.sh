#!/bin/bash

set -e

echo "🚀 Запуск проекта Telemarketing Analytics..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker не установлен. Установите Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose не установлен. Установите Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi

# Создание .env файлов если их нет
if [ ! -f backend/.env ]; then
    echo "📝 Создание backend/.env..."
    cp backend/.env.example backend/.env
    echo "✅ Создан backend/.env. Проверьте настройки!"
fi

if [ ! -f .env ]; then
    echo "📝 Создание .env для фронтенда..."
    cp .env.example .env
    echo "✅ Создан .env. Проверьте настройки!"
fi

# Сборка и запуск
echo "🔨 Сборка контейнеров..."
DOCKER_BUILDKIT=0 COMPOSE_DOCKER_CLI_BUILD=0 docker-compose -p telemarketing build

echo "🚀 Запуск сервисов..."
docker-compose -p telemarketing up -d

echo "⏳ Ожидание готовности сервисов..."
sleep 10

# Проверка статуса
echo "📊 Статус сервисов:"
docker-compose -p telemarketing ps

echo ""
echo "✅ Проект запущен!"
echo ""
echo "🌐 Фронтенд: http://localhost"
echo "🔧 API: http://localhost/api"
echo "📊 База данных: localhost:5432"
echo ""
echo "📝 Логи: docker-compose logs -f"
echo "🛑 Остановка: docker-compose down"
echo ""
echo "💡 Для создания первого пользователя см. README.md"
