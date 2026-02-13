# Сводка миграции с Supabase на собственный VPS

## Что было сделано

### ✅ Бэкенд API сервер
- Создан Node.js/Express бэкенд с TypeScript
- Реализована JWT аутентификация
- Созданы все необходимые API endpoints:
  - `/api/auth/*` - аутентификация
  - `/api/users/*` - управление пользователями (админ)
  - `/api/projects/*` - управление проектами
  - `/api/calls/*` - работа со звонками
  - `/api/suppliers/*` - управление поставщиками
  - `/api/imports/*` - история импортов
  - `/api/import-csv` - импорт CSV данных

### ✅ База данных
- Создана схема PostgreSQL (`backend/database/schema.sql`)
- Все таблицы и функции перенесены
- Добавлена таблица `users` (заменяет `auth.users`)

### ✅ Фронтенд
- Создан API клиент (`src/lib/api.ts`)
- Обновлен хук `useAuth` для работы с JWT
- Обновлен компонент `Login`
- Убрана зависимость от Supabase

### ✅ Docker конфигурация
- Dockerfile для бэкенда
- docker-compose.yml с PostgreSQL и бэкендом
- Готово к развертыванию на VPS

## Что нужно сделать дальше

### 1. Обновить остальные компоненты фронтенда

Нужно заменить все использования `supabase` на `api` в следующих файлах:
- `src/pages/Projects.tsx`
- `src/pages/ProjectDashboard.tsx`
- `src/pages/ProjectCalls.tsx`
- `src/pages/ProjectImports.tsx`
- `src/pages/Admin.tsx`
- `src/pages/AdminProjectStatuses.tsx`
- `src/pages/ProjectStatus.tsx`
- `src/pages/Reanimation.tsx`
- `src/pages/ProjectCallLists.tsx`
- `src/pages/ProjectCallListDetail.tsx`
- `src/pages/ProjectSuppliersGCK.tsx`
- `src/pages/ProjectReport.tsx`
- `src/components/AppSidebar.tsx`
- `src/components/ProtectedRoute.tsx`

Пример замены:
```typescript
// Было:
const { data, error } = await supabase.from("projects").select("*");

// Стало:
const { projects } = await api.getProjects();
```

### 2. Добавить недостающие API endpoints

В бэкенде нужно добавить:
- Роуты для отчетов (call-lists, suppliers, export)
- Роуты для статусов проектов
- Роуты для реанимации
- Роуты для project_members (управление доступом)

### 3. Настроить переменные окружения

**Бэкенд** (`backend/.env`):
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/telemarketing_analytics
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
CORS_ORIGIN=http://localhost:8080
```

**Фронтенд** (`.env`):
```env
VITE_API_URL=http://localhost:3001/api
```

### 4. Создать первую миграцию базы данных

```bash
cd backend
psql -U postgres -d telemarketing_analytics -f database/schema.sql
```

### 5. Создать первого пользователя

Через SQL:
```sql
INSERT INTO users (email, password_hash) 
VALUES ('admin@app.local', '$2a$10$...'); -- Используйте bcrypt для хеширования пароля

INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM users WHERE email = 'admin@app.local';
```

Или через API после создания админа вручную.

## Быстрый старт

1. **Запуск бэкенда:**
```bash
cd backend
npm install
cp .env.example .env
# Настройте .env
npm run dev
```

2. **Создание БД:**
```bash
createdb telemarketing_analytics
psql -U postgres -d telemarketing_analytics -f database/schema.sql
```

3. **Запуск фронтенда:**
```bash
npm install
cp .env.example .env
# Настройте VITE_API_URL
npm run dev
```

## Docker развертывание

```bash
cd backend
docker-compose up -d --build
```

Подробные инструкции в `DEPLOYMENT.md`.

## Важные замечания

1. **Пароли**: Используйте `bcryptjs` для хеширования паролей при создании пользователей
2. **JWT Secret**: Обязательно измените `JWT_SECRET` на случайную строку в продакшене
3. **CORS**: Настройте `CORS_ORIGIN` для вашего домена
4. **База данных**: Используйте сильные пароли для PostgreSQL в продакшене
5. **HTTPS**: Настройте SSL сертификат для продакшена (Let's Encrypt)

## Следующие шаги

1. Обновить все компоненты фронтенда для использования нового API
2. Добавить недостающие endpoints в бэкенд
3. Протестировать все функции
4. Настроить мониторинг и логирование
5. Настроить резервное копирование БД
