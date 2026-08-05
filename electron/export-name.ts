/** Nombre sugerido para export manual: tienda_export_<YYYYMMDD_HHmm>.db. */
export function exportName(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `tienda_export_${d.getFullYear()}${p(d.getMonth() + 1)}${p(
    d.getDate(),
  )}_${p(d.getHours())}${p(d.getMinutes())}.db`;
}
