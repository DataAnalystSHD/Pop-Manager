export function msToSecCeil(ms) {
  if (!ms || !Number.isFinite(ms)) return 0;
  return Math.max(0, Math.ceil(ms / 1000));
}