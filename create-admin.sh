#!/bin/bash

set -e

echo "👤 Создание администратора..."

# Проверка запущен ли контейнер
if ! docker ps | grep -q telemarketing-postgres; then
    echo "❌ PostgreSQL контейнер не запущен. Запустите проект: ./start.sh"
    exit 1
fi

read -p "Логин (по умолчанию: admin): " LOGIN
LOGIN=${LOGIN:-admin}

read -sp "Пароль: " PASSWORD
echo ""

if [ -z "$PASSWORD" ]; then
    echo "❌ Пароль не может быть пустым"
    exit 1
fi

# Генерируем хеш пароля используя Node.js в контейнере
echo "🔐 Хеширование пароля..."
HASH=$(docker exec telemarketing-backend node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('$PASSWORD', 10))")

EMAIL="${LOGIN}@app.local"
if [[ "$LOGIN" == *"@"* ]]; then
    EMAIL="$LOGIN"
fi

echo "📝 Создание пользователя в базе данных..."
docker exec -i telemarketing-postgres psql -U postgres -d telemarketing_analytics <<EOF
-- Создаем пользователя
INSERT INTO users (email, password_hash) 
VALUES ('$EMAIL', '$HASH')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Делаем админом
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM users WHERE email = '$EMAIL'
ON CONFLICT (user_id, role) DO NOTHING;
EOF

echo ""
echo "✅ Администратор создан!"
echo "📧 Email: $EMAIL"
echo "🔑 Пароль: [скрыт]"
echo ""
echo "🌐 Войдите на http://localhost"
