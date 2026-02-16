# Аудит логики расчётов

## Стандартные формулы (единообразно везде)

| Метрика | Формула |
|---------|---------|
| **% прозвона** | Прозвонено / Получено × 100% |
| **% дозвона** | Уникальные номера со статусом «Успешный» / Прозвонено × 100% |
| **% конв. в лид** | Лиды (уник.) / Дозвонившиеся (уник.) × 100% |
| **Дозвонились** | Уникальные номера с хотя бы одним успешным звонком |
| **Лиды** | Уникальные номера с is_lead = true |
| **Прозвонено** | Уникальные номера, по которым был звонок |
| **Получено** | Уникальные номера в базе (supplier_numbers) |

**Успешный статус** (`isStatusSuccessful`): `успешный`, `ответ`, `answered`, `success` (без учёта регистра).

---

## Проверенные страницы

### ProjectDashboard
- ✅ Общие метрики: answerRate = answeredPhones / calledPhones
- ✅ Дозвонились = answeredPhones.size
- ✅ Финансы: costPerLead = totalCost / leads
- ✅ Базы (таблица): callRate, answerRate, convRate — по уникальным
- ✅ ГЦК: те же формулы
- ✅ Динамика по дням: answerRate = answeredPhones / calledPhones за день
- ✅ Фильтр по дате применяется к allCalls и allNumbers

### ProjectCalls
- ✅ answerRate = answeredPhones / calledPhones
- ✅ Дозвонились, Лиды = уникальные номера
- ✅ Фильтры: поиск, статус, лид, колл-лист, период

### ProjectSuppliersGCK (Базы)
- ✅ call_rate = called / received
- ✅ answer_rate = answeredPhones / called
- ✅ conversion_rate = leads / answeredPhones
- ✅ Totals: суммируем по строкам (поставщики не пересекаются по номерам)
- ✅ spent = received × price_per_contact

### ProjectCallLists
- ✅ По каждому колл-листу: received=called, answer_rate, conversion_rate
- ✅ **Totals**: пересчитаны из сырых звонков (без двойного подсчёта номеров между списками)

### ProjectCallListDetail
- ✅ По дням: received=called за день, answer_rate, conversion_rate
- ✅ **Totals**: пересчитаны из сырых звонков (без двойного подсчёта между днями)

### ProjectReport (ГЦК)
- ✅ По дням: answerRate = answeredPhones / called
- ✅ convCall = called / contacts (Получено контактов за день)
- ✅ convLead = leads / answered
- ✅ KPI-карточки: pctAnswered = totAnswered / calledSet (уник.)

### Admin (вкладка Статистика)
- ✅ answerRate = answeredPhones / calledPhones
- ✅ convCall, convLead — те же формулы
- ✅ costPerLead = totalCost / leads

### AdminProjectStatuses
- ✅ getMetrics: answerRate, convCall, convLead — по уникальным
- ✅ costPerLead = totalCost / leads

---

## Исправления, внесённые при аудите

1. **ProjectCallLists totals** — ранее суммировали по строкам; один номер в нескольких колл-листах учитывался несколько раз. Итоги пересчитаны из сырых звонков.
2. **ProjectCallListDetail totals** — аналогично; один номер в разные дни учитывался дважды. Итоги пересчитаны из сырых звонков.
3. **ProjectDashboard metrics.answered** — приведено к уникальным номерам (answeredPhones.size).
4. **ProjectCalls metrics.answered** — приведено к уникальным номерам.
5. Обновлены подсказки (info) для карточек «Дозвонились» и «Лиды».
