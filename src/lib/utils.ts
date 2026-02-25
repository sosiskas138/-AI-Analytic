import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Звонок со статусом «Успешный» — дозвонились (учёт минут только по ним) */
export function isStatusSuccessful(status: string | null | undefined): boolean {
  if (status == null || typeof status !== "string") return false;
  const s = status.toLowerCase().trim();
  return s === "успешный" || s === "ответ" || s === "answered" || s === "success";
}
