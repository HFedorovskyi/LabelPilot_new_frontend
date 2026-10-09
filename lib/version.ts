/** Parse "1.2.3", "v1.2.3", "1.2.3-beta" → numeric tuple for ordering. */
export function parseVersion(v: string | null | undefined): number[] {
  if (!v) return [];
  const clean = String(v).trim().replace(/^v/i, "").split(/[+\-]/)[0];
  const parts = clean.split(".").map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
  return parts.length ? parts : [];
}

/** True if `a` is strictly greater than `b` (semver-like, numeric segments only). */
export function isNewerVersion(a: string | null | undefined, b: string | null | undefined): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa.length) return false;
  if (!pb.length) return true; // known remote vs unknown local → treat as newer
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
