import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Звонок со статусом «Успешный» — дозвонились (отдельно от лида) */
export function isStatusSuccessful(status: string | null | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return s === "успешный" || s === "ответ" || s === "answered" || s === "success";
}
