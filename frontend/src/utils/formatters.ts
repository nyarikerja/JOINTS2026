/**
 * utils/formatters.ts - Utilitas Format Data Standar Indonesia
 */

export function formatNumber(num?: number | null): string {
  if (num === null || num === undefined || isNaN(num)) return "-";
  return Number(num).toLocaleString("id-ID");
}

export function formatCompactRange(min?: number, median?: number, max?: number): string {
  if (min === undefined || median === undefined || max === undefined) {
    return "- / - / -";
  }
  return `${formatNumber(min)} / ${formatNumber(median)} / ${formatNumber(max)}`;
}

export function formatHour(hour: number): string {
  const h = String(hour).padStart(2, "0");
  return `T + ${h}:00 Jam`;
}
