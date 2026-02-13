# 🚀 Быстрый старт проекта

## Запуск всего стека одной командой

```bash
./start.sh
```

Этот скрипт:
1. ✅ Проверит наличие Docker
2. ✅ Создаст файлы `.env` если их нет
3. ✅ Соберет все контейнеры
4. ✅ Запустит все сервисы

## Создание первого администратора

После запуска создайте первого пользователя:

```bash
./create-admin.sh
```

Или вручную через SQL:
```bash
docker exec -it telemarketing-postgres psql -U postgres -d telemarketing_analytics
```

```sql
-- Пароль: admin123 (замените хеш на свой)
INSERT INTO users (email, password_hash) 
VALUES ('admin@app.local', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM users WHERE email = 'admin@app.local';
```

## Доступ к приложению

- 🌐 **Фронтенд**: http://localhost
- 🔧 **API**: http://localhost/api
- 📊 **База данных**: localhost:5432
  - User: `postgres`
  - Password: `postgres`
  - Database: `telemarketing_analytics`

## Полезные команды

```bash
# Просмотр логов
docker-compose -p telemarketing logs -f

# Остановка
./stop.sh

# Перезапуск
docker-compose -p telemarketing restart

# Статус сервисов
docker-compose -p telemarketing ps
```

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

```bash
# Очистка и пересборка
docker-compose -p telemarketing down -v
docker-compose -p telemarketing build --no-cache
docker-compose -p telemarketing up -d
```

### База данных не инициализирована

```bash
# Проверка логов БД
docker-compose -p telemarketing logs postgres

# Ручная инициализация
docker exec -i telemarketing-postgres psql -U postgres -d telemarketing_analytics < backend/database/schema.sql
```

## Разработка

Для разработки с hot-reload запустите фронтенд отдельно:

```bash
npm install
npm run dev
```

Фронтенд будет на http://localhost:8080, API на http://localhost/api
