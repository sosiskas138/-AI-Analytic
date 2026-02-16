/**
 * Единые формулы расчёта метрик проекта.
 * См. CALCULATION_AUDIT.md
 */

import { isStatusSuccessful } from "./utils";

export interface CallLike {
  phone_normalized: string;
  status?: string | null;
  is_lead?: boolean;
  call_at?: string;
  duration_seconds?: number;
  billed_minutes?: number;
}

export interface NumberLike {
  phone_normalized: string;
  supplier_id?: string;
  is_duplicate_in_project?: boolean;
}

/** Агрегаты из звонков (уникальные номера) */
export function aggregateFromCalls(calls: CallLike[], dateFilter?: { from?: string; to?: string }) {
  const calledPhones = new Set<string>();
  const answeredPhones = new Set<string>();
  const leadPhones = new Set<string>();
  let totalCalls = 0;
  let totalDuration = 0;
  let answeredCallsCount = 0;

  for (const c of calls) {
    if (dateFilter?.from || dateFilter?.to) {
      const date = c.call_at?.slice(0, 10);
      if (dateFilter.from && date && date < dateFilter.from) continue;
      if (dateFilter.to && date && date > dateFilter.to) continue;
    }
    const phone = c.phone_normalized;
    if (!phone) continue;
    totalCalls++;
    calledPhones.add(phone);
    if (isStatusSuccessful(c.status)) {
      answeredPhones.add(phone);
      answeredCallsCount++;
      totalDuration += c.duration_seconds || 0;
    }
    if (c.is_lead) leadPhones.add(phone);
  }

  const called = calledPhones.size;
  const answered = answeredPhones.size;
  const leads = leadPhones.size;

  return {
    totalCalls,
    called,
    answered,
    leads,
    totalDuration,
    answeredCallsCount,
    answerRate: called > 0 ? +((answered / called) * 100).toFixed(1) : 0,
    conversionRate: answered > 0 ? +((leads / answered) * 100).toFixed(1) : 0,
    avgDuration: answeredCallsCount > 0 ? Math.round(totalDuration / answeredCallsCount) : 0,
  };
}

/** Уникальные номера в базе (supplier_numbers). Получено = уник. номера. */
export function uniquePhonesFromNumbers(numbers: NumberLike[], excludeDuplicates = false): number {
  const set = new Set<string>();
  for (const n of numbers) {
    if (excludeDuplicates && n.is_duplicate_in_project) continue;
    set.add(n.phone_normalized);
  }
  return set.size;
}

/** spent для колл-листов/по дням: прозвоненные × ppc (без двойного подсчёта при суммировании) */
export function spentForCalledPhones(uniqueCalledCount: number, ppc: number): number {
  return uniqueCalledCount * ppc;
}
