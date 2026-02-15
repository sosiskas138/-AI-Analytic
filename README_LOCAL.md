# Локальное развертывание проекта

## Быстрый старт

### 1. Запуск всего стека

```bash
./start.sh
```

Или вручную:
```bash
docker-compose up -d --build
```

### 2. Первый вход

При первом запуске бэкенд создаёт администратора: **логин** `admin`, **пароль** `admin1`.

При необходимости создать ещё одного пользователя вручную через SQL:
```bash
docker exec -it telemarketing-postgres psql -U postgres -d telemarketing_analytics
```

```sql
-- Хеш пароля "admin123" (замените на свой)
INSERT INTO users (email, password_hash) 
VALUES ('admin@app.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM users WHERE email = 'admin@app.local';
```

### 3. Открыть в браузере

- **Фронтенд**: http://localhost
- **API**: http://localhost/api
- **База данных**: localhost:5432

## Управление

### Просмотр логов
```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
docker-compose logs -f postgres
```

### Остановка
```bash
./stop.sh
# или
docker-compose down
```

### Перезапуск
```bash
docker-compose restart
```

### Очистка (удаление всех данных)
```bash
docker-compose down -v
```

## Структура сервисов

- **nginx** (порт 80) - Веб-сервер и прокси для API
- **frontend** - React приложение
- **backend** (порт 3001) - Node.js API сервер
- **postgres** (порт 5432) - База данных PostgreSQL

## Переменные окружения

### Бэкенд (`backend/.env`)
```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/telemarketing_analytics
JWT_SECRET=local-dev-secret-change-in-production
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost
```

### Фронтенд (`.env`)
```env
VITE_API_URL=http://localhost/api
```

## Доступ к базе данных

```bash
# Подключение через psql
docker exec -it telemarketing-postgres psql -U postgres -d telemarketing_analytics

# Или через внешний клиент
# Host: localhost
# Port: 5432
# Database: telemarketing_analytics
# User: postgres
# Password: postgres
```

## Решение проблем

### Порт уже занят
Если порт 80 занят, измените в `docker-compose.yml`:
```yaml
nginx:
  ports:
    - "8080:80"  # Используйте другой порт
```

### Ошибки при сборке
```bash
# Очистка кеша Docker
docker-compose build --no-cache
```

### База данных не инициализирована
```bash
# Пересоздание БД
docker-compose down -v
docker-compose up -d postgres
sleep 5
docker exec -i telemarketing-postgres psql -U postgres -d telemarketing_analytics < backend/database/schema.sql
```

### Проверка статуса
```bash
docker-compose ps
docker-compose logs backend
```

## Разработка

### Режим разработки с hot-reload

Бэкенд уже настроен на hot-reload через volumes.

Для фронтенда можно запустить отдельно:
```bash
npm install
npm run dev
```

Тогда фронтенд будет на http://localhost:8080, а API на http://localhost/api через nginx.

## Резервное копирование

```bash
# Бэкап БД
docker exec telemarketing-postgres pg_dump -U postgres telemarketing_analytics > backup.sql

# Восстановление
docker exec -i telemarketing-postgres psql -U postgres telemarketing_analytics < backup.sql
```
