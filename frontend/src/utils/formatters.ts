/**
 * utils/formatters.ts - Utilitas Format Data Standar Indonesia
 */

export function formatNumber(num?: number | null, decimals: number = 0): string {
  if (num === null || num === undefined || isNaN(num)) return "-";
  return Number(num).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  });
}

export function formatCompactRange(min?: number, median?: number, max?: number, decimals: number = 0): string {
  if (min === undefined || median === undefined || max === undefined) {
    return "- / - / -";
  }
  return `${formatNumber(min, decimals)} / ${formatNumber(median, decimals)} / ${formatNumber(max, decimals)}`;
}

export function formatHour(hour: number): string {
  const h = String(hour).padStart(2, "0");
  return `H + ${h}:00 Jam`;
}
