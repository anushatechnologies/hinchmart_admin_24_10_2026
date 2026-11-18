// Currency, distance, dimension and date formatting utilities for HinchMart Admin
// Delivery Pricing module (V41).

const INR_SYMBOL = "\u20b9";

/**
 * Format a number as INR with thousands separators and exactly 2 decimal places.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatInr(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "\u20b9\u2014";
  return `${INR_SYMBOL}${num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format a number with a fixed number of decimals, fallback to dash.
 * @param {number|string|null|undefined} value
 * @param {number} decimals
 * @returns {string}
 */
export function formatNumber(value, decimals = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/**
 * Format a distance in kilometres with up to 2 decimals.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatKm(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/**
 * Format a dimension in millimetres with 2 decimals.
 * @param {number|string|null|undefined} value
 * @returns {string}
 */
export function formatMm(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "\u2014";
  return num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format an ISO-8601 datetime string for display in the UI.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatDateTime(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/**
 * Format a date-only ISO string for display.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function formatDate(value) {
  if (!value) return "\u2014";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Extract a numeric id from a value that may be a number or a string.
 * @param {unknown} id
 * @returns {number}
 */
export function toId(id) {
  const num = Number(id);
  return Number.isFinite(num) ? num : null;
}
