# Аудит проекта: Telemarketing Analytics

**Примечание:** Исправления по пунктам High (кроме глобальной обработки async-ошибок Express) и части Medium внесены в код. Оставшееся: обёртка async-обработчиков (express-async-handler или аналог), пагинация на UI для звонков, опционально — редирект на /login в useAuth при 401.

---

## 1. Карта проекта

- **Стек**: Frontend — React 18 + Vite + TypeScript + TanStack Query + Tailwind/shadcn; Backend — Express 4 + pg + JWT + bcrypt; БД — PostgreSQL 15.
- **Точки входа**: Frontend: `index.html` → `src/main.tsx` → `App.tsx`; Backend: `backend/src/index.ts` (Express, порт 3001).
- **Роутинг**: React Router в `App.tsx`; API под префиксом `/api/*` (auth, users, projects, calls, suppliers, imports, import-csv, reanimation).
- **Сборка**: `vite build` (frontend), `tsc` (backend); Docker: postgres, backend, frontend (build), nginx (порт 80).
- **Конфиги**: `vite.config.ts`, `tailwind.config.ts`, `backend/tsconfig.json`; env: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, `VITE_API_URL`.
- **Критичные модули**: Auth — `backend/src/config/auth.ts`, `middleware/auth.ts`, `routes/auth.ts`; доступ к проектам — `requireProjectAccess`; данные — `routes/calls.ts`, `import-csv.ts`, `reanimation.ts`, `projects.ts`.
- **Фронт**: API-клиент `src/lib/api.ts` (один класс, fetch + localStorage токен); доступ по вкладкам — `useProjectAccess`, guard в layout (компонент не найден в репо по имени, логика в summary).

---

## 2. Проблемы (Severity / Где / Симптом / Риск / Фикс)

| Sev | Где | Симптом | Риск | Фикс |
|-----|-----|---------|------|------|
| **High** | `backend/src/config/auth.ts:4` | `JWT_SECRET` fallback `'change-this-secret'` при отсутствии env | Подбор/подделка JWT в проде | Требовать `JWT_SECRET` в production, падать при старте если нет |
| **High** | `backend/src/routes/projects.ts:324-341` | `PUT /:projectId/status` строит SQL из `Object.keys(updateData)` — имена колонок из тела запроса попадают в запрос | SQL-инъекция через ключи (например `responsible; DROP TABLE project_status;--`) | Разрешить только whitelist колонок (например `responsible`) |
| **High** | `backend/src/routes/reanimation.ts:85` | `GET /exports/:exportId/numbers` только `authenticate`, без проверки доступа к проекту экспорта | IDOR: любой авторизованный пользователь может читать номера любого экспорта | Добавить проверку: экспорт принадлежит проекту и у пользователя есть доступ к проекту |
| **High** | `backend/src/index.ts` + все async-роуты | Express 4 не передаёт reject из async-обработчиков в `app.use((err,...))` | Необработанные исключения, 500 без ответа клиенту, возможные утечки в логах | Обернуть async-обработчики (express-async-handler или обёртка) или перейти на Express 5 |
| **Medium** | `backend/src/routes/calls.ts:59-65` | `page` и `pageSize` из query без ограничений | DoS: запрос с `pageSize=1000000` или отрицательными значениями | Ограничить pageSize (например max 500), нормализовать page ≥ 1 |
| **Medium** | `src/pages/ProjectCalls.tsx:81-96`, `ProjectDashboard.tsx:50-66` | Загрузка всех звонков в цикле (pageSize 1000) в один запрос/кэш | При большом числе звонков — огромный расход памяти и времени, возможный таймаут | Серверная пагинация + отображение по страницам; не тянуть все страницы в один список на клиенте |
| **Medium** | `src/lib/api.ts:55` | Успешный ответ всегда парсится как `response.json()` | При 204 или пустом теле — исключение | Проверять `response.headers.get('content-length')` или статус 204 и не вызывать `.json()` при пустом теле |
| **Medium** | `backend/src/routes/import-csv.ts` | Один запрос может принять до 50mb JSON, циклы вставок без таймаута | Долгие запросы блокируют воркер, риск OOM при огромном `rows` | Ограничить `rows.length` (например 50_000), рассмотреть фоновую очередь для очень больших импортов |
| **Medium** | `backend/src/routes/reanimation.ts:22-62` | `phone_numbers` в теле без жёсткого лимита длины | Большой массив — нагрузка на БД и память | Ограничить длину `phone_numbers` (например 100_000) и батчить с паузами при необходимости |
| **Low** | `backend/src/config/auth.ts` | Нет явной проверки алгоритма JWT | Теоретически jwt.verify по умолчанию использует подпись из токена | Явно задать `algorithms: ['HS256']` в verify |
| **Low** | Разные роуты | Ошибки логируются как `console.error` без структуры/уровней | Сложность поиска и мониторинга в проде | Ввести структурированный логгер (уровень, requestId, без PII в логах) |
| **Low** | `src/hooks/useAuth.tsx` | При ошибке getMe только сброс токена и состояния, нет редиректа на /login | Пользователь может остаться на защищённой странице с пустым user | После setSession(null) при 401 — navigate('/login') |
| **Low** | `backend/src/routes/calls.ts:94-108` | Удаление звонков: N запросов к БД по числу проектов в batch | Небольшой N+1 при удалении из нескольких проектов | Один запрос: получить project_id по id звонков, проверить доступ для уникальных project_id |

---

## 3. Патчи

### 3.1 [High] JWT_SECRET в production

**Файл:** `backend/src/config/auth.ts`

```diff
-const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
+const JWT_SECRET = process.env.JWT_SECRET;
+if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
+  throw new Error('JWT_SECRET must be set in production');
+}
+const effectiveSecret = JWT_SECRET || 'change-this-secret';
 const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

 export function generateToken(payload: JWTPayload): string {
-  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
+  return jwt.sign(payload, effectiveSecret, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
 }

 export function verifyToken(token: string): JWTPayload {
-  return jwt.verify(token, JWT_SECRET) as JWTPayload;
+  return jwt.verify(token, effectiveSecret, { algorithms: ['HS256'] }) as JWTPayload;
 }
```

**Почему:** В production без JWT_SECRET приложение не должно стартовать; явный алгоритм уменьшает риск алго-подмены.

---

### 3.2 [High] SQL-инъекция в PUT project status

**Файл:** `backend/src/routes/projects.ts`

Разрешать только известные колонки (по схеме: `responsible` — единственная редактируемая из API).

```diff
 // Update project status
 router.put('/:projectId/status', authenticate, requireProjectAccess, async (req, res) => {
   try {
     const projectId = req.params.projectId;
-    const updateData = req.body;
+    const ALLOWED_STATUS_KEYS = ['responsible'] as const;
+    const updateData: Record<string, unknown> = {};
+    for (const key of ALLOWED_STATUS_KEYS) {
+      if (req.body[key] !== undefined) {
+        updateData[key] = req.body[key];
+      }
+    }
+    if (Object.keys(updateData).length === 0) {
+      return res.status(400).json({ error: 'No allowed fields to update' });
+    }

     const existing = await query(
       'SELECT id FROM project_status WHERE project_id = $1',
       [projectId]
     );

     let result;
     if (existing.rows.length > 0) {
       const setClause = Object.keys(updateData)
         .map((key, idx) => `${key} = $${idx + 2}`)
         .join(', ');
       result = await query(
         `UPDATE project_status SET ${setClause} WHERE project_id = $1 RETURNING *`,
         [projectId, ...Object.values(updateData)]
       );
     } else {
       const keys = Object.keys(updateData);
       const values = Object.values(updateData);
       const placeholders = keys.map((_, idx) => `$${idx + 2}`).join(', ');
       result = await query(
         `INSERT INTO project_status (project_id, ${keys.join(', ')}) VALUES ($1, ${placeholders}) RETURNING *`,
         [projectId, ...values]
       );
     }

     res.json(result.rows[0]);
   } catch (error: any) {
     ...
   }
 });
```

**Почему:** Имена колонок больше не приходят из пользовательского ввода — только из whitelist.

---

### 3.3 [High] IDOR в GET reanimation export numbers

**Файл:** `backend/src/routes/reanimation.ts`

Нужно проверить, что экспорт принадлежит проекту и у пользователя есть доступ к этому проекту.

```diff
-// Get export numbers
-router.get('/exports/:exportId/numbers', authenticate, async (req, res) => {
+// Get export numbers (user must have access to the export's project)
+router.get('/exports/:exportId/numbers', authenticate, requireProjectAccess, async (req, res) => {
   try {
-    const { exportId } = req.params;
+    const { exportId } = req.params;
     const { page = 1, pageSize = 1000 } = req.query;
+
+    const exportRow = await query(
+      'SELECT project_id FROM reanimation_exports WHERE id = $1',
+      [exportId]
+    );
+    if (exportRow.rows.length === 0) {
+      return res.status(404).json({ error: 'Export not found' });
+    }
+    const projectId = exportRow.rows[0].project_id;
+    if (req.params.projectId !== projectId) {
+      return res.status(403).json({ error: 'No access to this export' });
+    }
```

Проблема: `requireProjectAccess` берёт `projectId` из `req.params.projectId`, а в этом роуте параметр — `exportId`. Нужно либо отдельная middleware «resolve export and check project access», либо передать projectId в query/body. Проще: отдельная проверка внутри обработчика.

```diff
-// Get export numbers
-router.get('/exports/:exportId/numbers', authenticate, async (req, res) => {
+// Get export numbers (user must have access to the export's project)
+router.get('/exports/:exportId/numbers', authenticate, async (req: AuthRequest, res) => {
   try {
     const { exportId } = req.params;
     const { page = 1, pageSize = 1000 } = req.query;
+
+    const exportRow = await query(
+      'SELECT project_id FROM reanimation_exports WHERE id = $1',
+      [exportId]
+    );
+    if (exportRow.rows.length === 0) {
+      return res.status(404).json({ error: 'Export not found' });
+    }
+    const projectId = exportRow.rows[0].project_id;
+    if (!req.user!.isAdmin) {
+      const member = await query(
+        'SELECT 1 FROM project_members WHERE user_id = $1 AND project_id = $2',
+        [req.user!.userId, projectId]
+      );
+      if (member.rows.length === 0) {
+        return res.status(403).json({ error: 'No access to this export' });
+      }
+    }
```

И добавить импорт AuthRequest. Это и есть фикс IDOR.

---

### 3.4 [High] Async errors не попадают в error handler (Express 4)

**Файл:** `backend/src/index.ts`

Вариант: обёртка для async-обработчиков. Добавить в начало файла после импортов:

```ts
function asyncHandler(fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<any>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

И оборачивать все async-роуты. Более простой вариант — глобально обернуть все роуты через патч роутера (сложнее). Практичный минимум: обернуть только критические маршруты (auth, projects, calls, import-csv, reanimation) вручную вызовом `asyncHandler` вокруг существующих обработчиков, либо подключить пакет `express-async-handler` и использовать его для всех async-роутов.

**Рекомендация:** Установить `express-async-handler`, в каждом роутере заменить `async (req, res) => { ... }` на `asyncHandler(async (req, res) => { ... })` и убедиться, что в конце цепочки стоит error middleware.

---

### 3.5 [Medium] Лимиты пагинации в calls

**Файл:** `backend/src/routes/calls.ts`

```diff
   const { projectId } = req.params;
-  const { page = 1, pageSize = 50, status, phone, startDate, endDate, isGck } = req.query;
+  const rawPage = Number(req.query.page) || 1;
+  const rawPageSize = Number(req.query.pageSize) || 50;
+  const page = Math.max(1, Math.floor(rawPage));
+  const pageSize = Math.min(500, Math.max(1, Math.floor(rawPageSize)));
+  const { status, phone, startDate, endDate, isGck } = req.query;
```

И использовать `page`, `pageSize` в запросе и ответе. Аналогично ограничить `pageSize` в reanimation `GET /exports/:exportId/numbers` (например max 2000).

---

### 3.6 [Medium] Пустое тело ответа в api.ts

**Файл:** `src/lib/api.ts`

```diff
-    return response.json();
+    const contentType = response.headers.get('content-type');
+    if (response.status === 204 || (contentType && !contentType.includes('application/json'))) {
+      return undefined as T;
+    }
+    return response.json();
```

Либо проверять `response.status === 204` и возвращать `undefined as T`, не вызывая `.json()`.

---

### 3.7 [Medium] Лимит на размер rows в import-csv

**Файл:** `backend/src/routes/import-csv.ts`

```diff
   const { project_id, type, rows, filename, supplier_id, is_gck } = req.body;
   if (!project_id || !type || !rows || !Array.isArray(rows)) {
     return res.status(400).json({ error: 'Invalid payload' });
   }
+  const MAX_ROWS = 50_000;
+  if (rows.length > MAX_ROWS) {
+    return res.status(400).json({ error: `Too many rows. Maximum ${MAX_ROWS} per request.` });
+  }
```

---

### 3.8 [Medium] Лимит на phone_numbers в reanimation

**Файл:** `backend/src/routes/reanimation.ts`

```diff
   if (!project_id || !phone_numbers || !Array.isArray(phone_numbers)) {
     return res.status(400).json({ error: 'Invalid payload' });
   }
+  if (phone_numbers.length > 100_000) {
+    return res.status(400).json({ error: 'Too many phone numbers. Maximum 100000 per export.' });
+  }
```

---

## 4. План проверок

1. **Линтер**  
   - Frontend: `npm run lint` (корень).  
   - Backend: в `backend/` добавить `"lint": "tsc --noEmit"` и при необходимости eslint; запускать перед коммитом.

2. **Тесты**  
   - Сейчас: только пример в `src/test/example.test.ts`.  
   - Рекомендуемые тесты для High:  
     - **auth**: при отсутствии JWT_SECRET в NODE_ENV=production процесс падает при импорте/старте.  
     - **project status**: PUT с телом `{ "responsible": "OK" }` — 200; с телом `{ "responsible; DELETE FROM project_status; --": "x" }` — обновляется только поле `responsible` (значение как строка), никакого DELETE (после фикса whitelist).  
     - **reanimation numbers**: GET без доступа к проекту экспорта — 403; с доступом — 200.  
     - **calls pagination**: GET с pageSize=10000 — сервер возвращает не более 500 записей (после фикса лимита).

3. **Ручная проверка**  
   - Включить NODE_ENV=production и не задавать JWT_SECRET — приложение не должно стартовать.  
   - Вызвать PUT project status с произвольными ключами в body — в SQL должны попадать только разрешённые колонки.  
   - Под пользователем без доступа к проекту вызвать GET reanimation/export/:id/numbers — ожидать 403.

4. **Производительность**  
   - ProjectCalls/ProjectDashboard: замерить время и объём памяти при 50k+ звонков (сейчас — загрузка всех в цикле); после введения серверной пагинации на UI — убедиться, что запрашивается одна страница и время ответа в норме.

5. **Регрессии**  
   - После фикса project status — проверить сохранение/обновление ответственного в UI.  
   - После фикса reanimation — проверить, что владелец проекта и админ по-прежнему видят номера экспорта.  
   - После лимитов pagination/import/reanimation — проверить обычные сценарии (небольшие списки, импорт до лимита).

---

## 5. Краткий список тестов для High

- **JWT_SECRET**: скрипт или тест, что при `NODE_ENV=production` и отсутствии `JWT_SECRET` конфиг/auth бросает или приложение не стартует.
- **Project status whitelist**: юнит-тест или интеграционный запрос PUT с `{ responsible: "Ivan" }` и с «злым» ключом — в сгенерированном SQL только колонка `responsible`.
- **Reanimation IDOR**: интеграционный тест: пользователь A создаёт экспорт, пользователь B (member другого проекта) запрашивает GET /exports/:idA/numbers — ожидать 403.
- **Async errors**: симулировать throw в одном из async-обработчиков и убедиться, что клиент получает 500 и в логах есть ошибка (после внедрения asyncHandler/express-async-handler).
