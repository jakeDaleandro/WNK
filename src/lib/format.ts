import type { Timestamp } from "firebase/firestore";

const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const compactFmt = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const numberFmt = new Intl.NumberFormat("en-US");

export const money = (n: number | null | undefined) => currencyFmt.format(n ?? 0);
export const num = (n: number | null | undefined) => numberFmt.format(n ?? 0);
export const compact = (n: number | null | undefined) => compactFmt.format(n ?? 0);

export function toDate(ts: Timestamp | Date | null | undefined): Date | null {
  if (!ts) return null;
  return ts instanceof Date ? ts : ts.toDate();
}

export function formatDate(ts: Timestamp | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(ts: Timestamp | Date | null | undefined) {
  const d = toDate(ts);
  if (!d) return "—";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function formatTime(ts: Timestamp | Date | null | undefined) {
  const d = toDate(ts);
  if (!d) return "—";
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today, ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}, ${time}`;
}

/** "2h 15m left", "8m left", "Closed" */
export function timeLeft(ts: Timestamp | Date | null | undefined, now = Date.now()) {
  const d = toDate(ts);
  if (!d) return "";
  const ms = d.getTime() - now;
  if (ms <= 0) return "Closed";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m left`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m left`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h left`;
}

export function minutesLeft(ts: Timestamp | Date | null | undefined, now = Date.now()) {
  const d = toDate(ts);
  return d ? (d.getTime() - now) / 60000 : 0;
}

export function relative(ts: Timestamp | Date | null | undefined) {
  const d = toDate(ts);
  if (!d) return "just now";
  const diff = (Date.now() - d.getTime()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  if (diff < 60) return "just now";
  if (diff < 3600) return rtf.format(-Math.round(diff / 60), "minute");
  if (diff < 86400) return rtf.format(-Math.round(diff / 3600), "hour");
  if (diff < 86400 * 30) return rtf.format(-Math.round(diff / 86400), "day");
  return formatDate(d);
}

export function discountPct(price: number, original: number | null) {
  if (!original || original <= price) return 0;
  return Math.round((1 - price / original) * 100);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Converts a Date into the value format of <input type="datetime-local">. */
export function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
