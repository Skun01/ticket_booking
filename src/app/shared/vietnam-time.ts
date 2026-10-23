/** Giá trị datetime-local theo giờ Việt Nam, không phụ thuộc timezone máy người dùng. */
export function vietnamDateInput(instant: string): string {
  return new Date(Date.parse(instant) + 7 * 60 * 60 * 1000).toISOString().slice(0, 19);
}

export function vietnamInstant(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const date = new Date(`${normalized}+07:00`);
  if (!Number.isFinite(date.getTime()) || vietnamDateInput(date.toISOString()) !== normalized)
    return null;
  return date.toISOString();
}

/** Khoảng mặc định cho báo cáo/tổng quan: 30 ngày gần nhất tính đến giây hiện tại. */
export function recentRevenueRange(): { from: string; to: string } {
  const to = Math.floor(Date.now() / 1000) * 1000;
  return { from: new Date(to - 30 * 86400000).toISOString(), to: new Date(to).toISOString() };
}
