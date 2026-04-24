/**
 * Central rating conversions.
 * App-wide scale: 0-10, with `null` = unrated.
 */

export function bggRatingToTen(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return null; // BGG uses 0 to mean unrated
  return Math.max(0, Math.min(10, n));
}

export function grouveeRatingToTen(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (!Number.isFinite(n) || n <= 0) return null;
  // Grouvee is 1-5 (half-stars as .5 in some exports). Multiply by 2.
  return Math.max(0, Math.min(10, n * 2));
}

export function displayRating(r: number | null | undefined): string {
  if (r === null || r === undefined) return "—";
  return r.toFixed(1).replace(/\.0$/, "");
}
