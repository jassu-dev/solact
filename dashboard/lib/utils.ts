import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(input: any) {
  if (!input) return "-";
  try {
    const d = new Date(input);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleString();
  } catch {
    return "-";
  }
}

export function formatRelative(input: any) {
  if (!input) return "-";
  try {
    const d = new Date(input).getTime();
    const now = Date.now();
    const diff = now - d;
    const s = Math.floor(diff / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  } catch {
    return "-";
  }
}

export function formatCurrency(amount: any, currency = "USD") {
  if (amount === null || amount === undefined || amount === "") return "-";
  const n = Number(amount);
  if (isNaN(n)) return String(amount);
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(n);
}
