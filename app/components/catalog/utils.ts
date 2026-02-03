export function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeDigits(input: string) {
  return input.replace(/[^\d]/g, "");
}

/**
 * EAN-13: 12 digits + check digit
 */
export function ean13CheckDigit(d12: string) {
  if (d12.length !== 12) return null;
  if (!/^\d{12}$/.test(d12)) return null;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const n = Number(d12[i]);
    sum += i % 2 === 0 ? n : n * 3;
  }
  const mod = sum % 10;
  const check = (10 - mod) % 10;
  return String(check);
}

export function makeEan13(baseDigits: string) {
  const d = normalizeDigits(baseDigits);
  if (d.length === 13 && /^\d{13}$/.test(d)) return d;
  const d12 = d.slice(0, 12).padEnd(12, "0");
  const cd = ean13CheckDigit(d12);
  if (!cd) return null;
  return `${d12}${cd}`;
}

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
