# Backend API для Telemarketing Analytics

## Установка и запуск

### Локальная разработка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` на основе `.env.example`:
```bash
cp .env.example .env
```

3. Настройте переменные окружения в `.env`

4. Создайте базу данных PostgreSQL и выполните миграцию:
```bash
psql -U postgres -d telemarketing_analytics -f database/schema.sql
```

5. Запустите сервер:
```bash
npm run dev
```

### Docker

1. Запустите все сервисы:
```bash
docker-compose up -d
```

2. Проверьте логи:
```bash
docker-compose logs -f backend
```

## API Endpoints

### Аутентификация
- `POST /api/auth/login` - Вход
- `GET /api/auth/me` - Получить текущего пользователя
- `POST /api/auth/logout` - Выход

### Пользователи (только для админов)
- `GET /api/users` - Список пользователей
- `POST /api/users` - Создать пользователя
- `PUT /api/users/:userId` - Обновить пользователя
- `DELETE /api/users/:userId` - Удалить пользователя

### Проекты
- `GET /api/projects` - Список проектов
- `GET /api/projects/:projectId` - Получить проект
- `POST /api/projects` - Создать проект (админ)
- `PUT /api/projects/:projectId` - Обновить проект (админ)
- `DELETE /api/projects/:projectId` - Удалить проект (админ)

### Звонки
- `GET /api/calls/project/:projectId` - Список звонков проекта
- `DELETE /api/calls/batch` - Удалить звонки

### Поставщики
- `GET /api/suppliers/project/:projectId` - Список поставщиков
- `POST /api/suppliers` - Создать поставщика (админ)
- `PUT /api/suppliers/:supplierId` - Обновить поставщика (админ)
- `DELETE /api/suppliers/:supplierId` - Удалить поставщика (админ)

### Импорт
- `GET /api/imports/project/:projectId` - История импортов
- `POST /api/import-csv` - Импорт CSV данных

## Переменные окружения

- `DATABASE_URL` - URL подключения к PostgreSQL
- `JWT_SECRET` - Секретный ключ для JWT токенов
- `JWT_EXPIRES_IN` - Время жизни токена (по умолчанию 7d)
- `PORT` - Порт сервера (по умолчанию 3001)
- `NODE_ENV` - Окружение (development/production)
- `CORS_ORIGIN` - Разрешенный origin для CORS
