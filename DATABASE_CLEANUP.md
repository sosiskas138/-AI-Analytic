# Очистка базы данных от "осиротевших" записей

## Проблема

При удалении сущностей (поставщиков, пользователей, проектов) в базе данных могут оставаться "осиротевшие" записи (orphaned records) - записи, которые ссылаются на несуществующие сущности. Это происходит из-за:

1. Неправильно настроенных CASCADE constraints в базе данных
2. Ручного удаления данных без учета связей
3. Ошибок в коде удаления

## Решение

### 1. Исправление CASCADE constraints

Обновлена схема базы данных (`backend/database/schema.sql`) для правильной обработки каскадного удаления:

- **`calls.supplier_number_id`**: Теперь `ON DELETE SET NULL` - при удалении `supplier_numbers` ссылка в `calls` обнуляется
- **`import_jobs.uploaded_by`**: Теперь `ON DELETE SET NULL` - при удалении пользователя ссылка обнуляется
- **`reanimation_exports.exported_by`**: Теперь `ON DELETE SET NULL` - при удалении пользователя ссылка обнуляется
- **`supplier_numbers.supplier_id`**: Уже был `ON DELETE CASCADE` - при удалении поставщика удаляются все его номера

### 2. Улучшенное удаление поставщика

В `backend/src/routes/suppliers.ts` добавлена явная очистка перед удалением:

```typescript
// Перед удалением поставщика обнуляем ссылки в calls
await query(
  `UPDATE calls SET supplier_number_id = NULL 
   WHERE supplier_number_id IN (
     SELECT id FROM supplier_numbers WHERE supplier_id = $1
   )`,
  [supplierId]
);

// Затем удаляем поставщика (CASCADE удалит supplier_numbers)
await query('DELETE FROM suppliers WHERE id = $1', [supplierId]);
```

### 3. Миграция для существующих баз данных

Создан файл `backend/database/migration_fix_cascade.sql` для применения исправлений к существующим базам данных. Миграция:

- Исправляет constraints для `calls`, `import_jobs`, `reanimation_exports`
- Очищает существующие "осиротевшие" записи

### 4. Функция очистки

Добавлен эндпоинт `POST /api/projects/cleanup/orphaned` (только для администраторов) для периодической очистки базы данных.

Функция очищает:
- `calls` с невалидными `supplier_number_id`
- `import_jobs` с невалидными `uploaded_by`
- `reanimation_exports` с невалидными `exported_by`
- `supplier_numbers` без существующих `supplier_id`
- `project_members` без существующих `project_id` или `user_id`
- `user_roles` без существующих `user_id`
- `profiles` без существующих `user_id`
- `calls` без существующих `project_id`
- `suppliers` без существующих `project_id`
- `project_pricing` без существующих `project_id`
- `project_status` без существующих `project_id`
- `import_jobs` без существующих `project_id`
- `reanimation_exports` без существующих `project_id`
- `reanimation_export_numbers` без существующих `export_id`

### 5. UI для очистки

В странице "Администрирование" (`src/pages/Admin.tsx`) добавлена кнопка "Очистить БД" в верхней части страницы. Кнопка:

- Доступна только администраторам
- Показывает подтверждение перед выполнением
- Отображает количество обработанных записей
- Обновляет данные после очистки

## Использование

### Автоматическая очистка (через CASCADE)

При удалении сущностей через API автоматически срабатывают CASCADE constraints:

- Удаление проекта → удаляются все связанные данные (calls, suppliers, supplier_numbers, и т.д.)
- Удаление поставщика → удаляются все `supplier_numbers`, ссылки в `calls` обнуляются
- Удаление пользователя → обнуляются ссылки в `import_jobs` и `reanimation_exports`

### Ручная очистка

1. Откройте страницу "Администрирование" (`/admin`)
2. Нажмите кнопку "Очистить БД" в верхней части страницы
3. Подтвердите действие
4. Дождитесь завершения очистки

### Программная очистка

```typescript
import { api } from '@/lib/api';

const result = await api.cleanupOrphanedRecords();
console.log(`Очищено записей: ${result.total_cleaned}`);
console.log('Детали:', result.results);
```

## Рекомендации

1. **Регулярная очистка**: Запускайте очистку периодически (например, раз в неделю) для поддержания целостности данных
2. **Мониторинг**: Проверяйте логи после очистки на наличие большого количества удаленных записей - это может указывать на проблемы в коде
3. **Резервное копирование**: Перед массовой очисткой рекомендуется создать резервную копию базы данных

## Файлы

- `backend/database/schema.sql` - обновленная схема БД
- `backend/database/migration_fix_cascade.sql` - миграция для существующих БД
- `backend/database/cleanup_orphaned.sql` - SQL скрипт для ручной очистки
- `backend/src/routes/suppliers.ts` - улучшенное удаление поставщика
- `backend/src/routes/projects.ts` - эндпоинт очистки
- `src/lib/api.ts` - метод `cleanupOrphanedRecords()`
- `src/pages/Admin.tsx` - UI кнопка очистки
