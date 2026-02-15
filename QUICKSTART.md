# 🚀 Быстрый старт проекта

## Запуск всего стека одной командой

```bash
./start.sh
```

Скрипт задаёт имя проекта `telemarketing` (чтобы папка с кириллицей/пробелами не ломала docker compose), собирает образы и поднимает контейнеры.

**Если сборка в IDE падает с ошибкой gRPC/buildx** — запустите из обычного терминала:
```bash
cd "путь/к/проекту"
./start.sh
```

## Первый вход

При первом запуске бэкенд сам создаёт администратора:
- **Логин:** `admin`
- **Пароль:** `admin1`

## Доступ к приложению

- 🌐 **Фронтенд**: http://localhost
- 🔧 **API**: http://localhost/api
- 📊 **База данных**: localhost:5432
  - User: `postgres`
  - Password: `postgres`
  - Database: `telemarketing_analytics`

## Проверка доступности (Postgres + API + фронт)

После запуска проверьте, что страницы и API отвечают:

```bash
./check-site.sh
```

Скрипт проверит: главную, API health, auth, статику, маршруты /login и /projects, логин в API.

## Полезные команды

```bash
# Просмотр логов
docker compose logs -f

# Остановка
./stop.sh

# Перезапуск
docker compose restart

# Статус сервисов
docker compose ps
```
(Имя проекта задаётся в `start.sh` через `COMPOSE_PROJECT_NAME=telemarketing`.)

## Структура сервисов

- **nginx** (порт 80) - Веб-сервер, проксирует API запросы
- **frontend** - React приложение (собирается в nginx)
- **backend** (порт 3001) - Node.js API сервер
- **postgres** (порт 5432) - PostgreSQL база данных

## Решение проблем

### Порт 80 занят

Измените в `docker-compose.yml`:
```yaml
nginx:
  ports:
    - "8080:80"  # Используйте другой порт
```

Тогда фронтенд будет на http://localhost:8080

### Ошибки при сборке

**Ошибка `x-docker-expose-session-sharedkey contains non-printable ASCII` (Buildx/gRPC):**  
Соберите с классическим builder:
```bash
export COMPOSE_PROJECT_NAME=telemarketing
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
docker compose build --no-cache
docker compose up -d
```
Или просто запустите `./start.sh` — в нём уже заданы эти переменные.

**Обычная пересборка:**
```bash
export COMPOSE_PROJECT_NAME=telemarketing
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### База данных не инициализирована

```bash
docker compose logs postgres
docker exec -i telemarketing-postgres psql -U postgres -d telemarketing_analytics < backend/database/schema.sql
```

## Разработка

Для разработки с hot-reload запустите фронтенд отдельно:

```bash
npm install
npm run dev
```

Фронтенд будет на http://localhost:8080, API на http://localhost/api
