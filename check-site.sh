#!/bin/bash
# Пошаговая проверка доступности сайта (Postgres + backend на :3001, фронт за nginx на :80)
set -e
BASE="${1:-http://localhost}"
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'
ok() { echo -e "${GREEN}OK${NC} $1"; }
fail() { echo -e "${RED}FAIL${NC} $1"; exit 1; }

echo "=== 1. Главная страница (/) ==="
code=$(curl -s -o /tmp/root.html -w "%{http_code}" "$BASE/")
[ "$code" = "200" ] && ok "HTTP $code" || fail "HTTP $code (ожидалось 200)"
grep -q "Аналитика звонков" /tmp/root.html && ok "Заголовок в HTML" || fail "Нет заголовка в HTML"

echo ""
echo "=== 2. API health ==="
code=$(curl -s -o /tmp/health.json -w "%{http_code}" "$BASE/api/health")
[ "$code" = "200" ] && ok "HTTP $code" || fail "HTTP $code"
grep -q '"status":"ok"' /tmp/health.json && ok "status ok" || fail "Нет status ok в ответе"

echo ""
echo "=== 3. API auth/me без токена (ожидаем 401) ==="
code=$(curl -s -o /tmp/me.json -w "%{http_code}" "$BASE/api/auth/me")
[ "$code" = "401" ] && ok "HTTP 401 Unauthorized" || fail "HTTP $code (ожидалось 401)"

echo ""
echo "=== 4. Статика (JS/CSS) ==="
js_url=$(grep -o 'src="/assets/[^"]*\.js"' /tmp/root.html | head -1 | sed 's/src="//;s/"//')
[ -n "$js_url" ] && js_url="$BASE$js_url" || js_url="$BASE/assets/index-DRc7sCk9.js"
code=$(curl -s -o /dev/null -w "%{http_code}" "$js_url")
[ "$code" = "200" ] && ok "JS bundle HTTP $code" || fail "JS HTTP $code"
code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/assets/index-Mn8iRgEz.css")
[ "$code" = "200" ] && ok "CSS HTTP $code" || fail "CSS HTTP $code"

echo ""
echo "=== 5. SPA-маршруты (должны отдавать index.html) ==="
for path in "/login" "/projects"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASE$path")
  [ "$code" = "200" ] && ok "$path HTTP $code" || fail "$path HTTP $code"
done

echo ""
echo "=== 6. Логин API (Postgres/backend) ==="
code=$(curl -s -o /tmp/login_resp.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" -d '{"login":"admin","password":"admin1"}')
if [ "$code" = "200" ]; then
  ok "Логин admin/admin1 HTTP $code — вход работает"
elif [ "$code" = "401" ]; then
  ok "Логин HTTP 401 — API отвечает (если админ не создан: перезапустите backend, seed создаст admin/admin1)"
else
  echo "Ответ: $(cat /tmp/login_resp.json 2>/dev/null)"
  fail "Логин HTTP $code"
fi

echo ""
echo -e "${GREEN}Все проверки пройдены.${NC}"
echo "Откройте в браузере: $BASE"
echo "Логин: admin  Пароль: admin1"
