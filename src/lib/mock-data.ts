export const projects = [
  { id: "1", name: "Москва Q1", description: "Обзвон базы Москва, январь–март", created_at: "2025-01-15", calls_count: 12450, leads: 342, conversion: 2.7 },
  { id: "2", name: "СПб Весна", description: "Санкт-Петербург весенняя кампания", created_at: "2025-03-01", calls_count: 8320, leads: 198, conversion: 2.4 },
  { id: "3", name: "Регионы Тест", description: "Тестовый обзвон регионов", created_at: "2025-04-10", calls_count: 3100, leads: 87, conversion: 2.8 },
];

export const dashboardKPIs = {
  uniqueCalls: 9832,
  totalCalls: 12450,
  repeatRate: 21.1,
  answerRate: 67.4,
  leads: 342,
  totalCost: 187500,
  costPerLead: 548.25,
};

export const callsPerDay = [
  { date: "01.01", calls: 320, leads: 8 },
  { date: "02.01", calls: 410, leads: 12 },
  { date: "03.01", calls: 380, leads: 9 },
  { date: "04.01", calls: 520, leads: 15 },
  { date: "05.01", calls: 0, leads: 0 },
  { date: "06.01", calls: 0, leads: 0 },
  { date: "07.01", calls: 490, leads: 14 },
  { date: "08.01", calls: 560, leads: 18 },
  { date: "09.01", calls: 430, leads: 11 },
  { date: "10.01", calls: 610, leads: 21 },
  { date: "11.01", calls: 580, leads: 16 },
  { date: "12.01", calls: 470, leads: 13 },
  { date: "13.01", calls: 390, leads: 10 },
  { date: "14.01", calls: 540, leads: 17 },
];

export const statusBreakdown = [
  { name: "Ответ", value: 67.4, fill: "hsl(var(--chart-2))" },
  { name: "Нет ответа", value: 18.2, fill: "hsl(var(--chart-4))" },
  { name: "Занято", value: 8.1, fill: "hsl(var(--chart-3))" },
  { name: "Ошибка", value: 6.3, fill: "hsl(var(--chart-5))" },
];

export const durationDistribution = [
  { range: "0–15с", count: 2100 },
  { range: "15–30с", count: 3400 },
  { range: "30–60с", count: 4200 },
  { range: "1–2м", count: 1800 },
  { range: "2–5м", count: 750 },
  { range: "5м+", count: 200 },
];

export const callsTableData = Array.from({ length: 25 }, (_, i) => ({
  id: `call-${i + 1}`,
  external_call_id: `EXT-${10000 + i}`,
  phone: `+7 (9${Math.floor(Math.random() * 90 + 10)}) ${Math.floor(Math.random() * 900 + 100)}-${Math.floor(Math.random() * 90 + 10)}-${Math.floor(Math.random() * 90 + 10)}`,
  call_at: new Date(2025, 0, Math.floor(Math.random() * 28) + 1, Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60)).toISOString(),
  duration: Math.floor(Math.random() * 300) + 5,
  status: ["Ответ", "Нет ответа", "Занято", "Ошибка"][Math.floor(Math.random() * 4)],
  is_lead: Math.random() > 0.85,
  attempt: Math.floor(Math.random() * 3) + 1,
  supplier: ["МТС", "Билайн", "Мегафон", "Tele2"][Math.floor(Math.random() * 4)],
}));

export const suppliersReport = [
  { name: "МТС", tag: "mts", total_numbers: 3200, duplicates: 180, duplicate_rate: 5.6, unique_calls: 2800, total_calls: 3400, leads: 95, conversion: 3.4, total_cost: 51000, cost_per_lead: 536.84 },
  { name: "Билайн", tag: "beeline", total_numbers: 2800, duplicates: 220, duplicate_rate: 7.9, unique_calls: 2400, total_calls: 3100, leads: 72, conversion: 3.0, total_cost: 46500, cost_per_lead: 645.83 },
  { name: "Мегафон", tag: "megafon", total_numbers: 2100, duplicates: 95, duplicate_rate: 4.5, unique_calls: 2000, total_calls: 2600, leads: 68, conversion: 3.4, total_cost: 39000, cost_per_lead: 573.53 },
  { name: "Tele2", tag: "tele2", total_numbers: 1900, duplicates: 150, duplicate_rate: 7.9, unique_calls: 1700, total_calls: 2200, leads: 42, conversion: 2.5, total_cost: 33000, cost_per_lead: 785.71 },
];
