# Инструкция по развертыванию на VPS

## Требования

- VPS с Ubuntu 20.04+ или Debian 11+
- Docker и Docker Compose установлены
- Домен (опционально, для HTTPS)

## Шаг 1: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

## Шаг 2: Клонирование проекта

```bash
git clone <your-repo-url> telemarketing-analytics
cd telemarketing-analytics
```

## Шаг 3: Настройка бэкенда

```bash
cd backend

# Создайте .env файл
cp .env.example .env
nano .env
```

Настройте переменные:
```env
DATABASE_URL=postgresql://postgres:your-secure-password@postgres:5432/telemarketing_analytics
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com
```

## Шаг 4: Настройка фронтенда

```bash
cd ../

# Создайте .env файл
cp .env.example .env
nano .env
```

Настройте переменную:
```env
VITE_API_URL=https://api.yourdomain.com/api
```

## Шаг 5: Сборка и запуск

### Бэкенд

```bash
cd backend
docker-compose up -d --build
```

### Фронтенд

```bash
cd ../
npm install
npm run build
```

Для продакшена используйте nginx для раздачи статических файлов:

```bash
sudo apt install nginx -y
sudo cp nginx.conf /etc/nginx/sites-available/telemarketing-analytics
sudo ln -s /etc/nginx/sites-available/telemarketing-analytics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Шаг 6: Настройка Nginx (опционально)

Создайте файл `/etc/nginx/sites-available/telemarketing-analytics`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend
    location / {
        root /path/to/telemarketing-analytics/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Шаг 7: Настройка SSL (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d yourdomain.com
```

## Шаг 8: Создание первого пользователя

Подключитесь к базе данных:

```bash
docker exec -it telemarketing-analytics-postgres-1 psql -U postgres -d telemarketing_analytics
```

Создайте пользователя:

```sql
-- Хеш пароля для "admin" (замените на реальный хеш)
INSERT INTO users (email, password_hash) 
VALUES ('admin@app.local', '$2a$10$YourHashedPasswordHere');

-- Сделайте пользователя админом
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM users WHERE email = 'admin@app.local';
```

Или используйте API после первого запуска:

```bash
curl -X POST http://localhost:3001/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "login": "admin",
    "password": "your-secure-password",
    "role": "admin"
  }'
```

## Мониторинг

```bash
# Логи бэкенда
docker-compose -f backend/docker-compose.yml logs -f backend

# Логи базы данных
docker-compose -f backend/docker-compose.yml logs -f postgres

# Статус сервисов
docker-compose -f backend/docker-compose.yml ps
```

## Резервное копирование

```bash
# Бэкап базы данных
docker exec telemarketing-analytics-postgres-1 pg_dump -U postgres telemarketing_analytics > backup.sql

# Восстановление
docker exec -i telemarketing-analytics-postgres-1 psql -U postgres telemarketing_analytics < backup.sql
```
