// src/core/utils/errorToString.ts
export function errorToString(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  try { return JSON.stringify(err); } catch { return "Ismeretlen hiba"; }
}
