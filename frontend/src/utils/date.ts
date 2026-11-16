/**
 * Chuyển đổi chuỗi thời gian UTC từ D1 Database (SQLite format YYYY-MM-DD HH:mm:ss)
 * sang múi giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh - GMT+7).
 */
export function formatVNDateTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  let str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

export function formatVNTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  let str = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(str)) {
    str = str.replace(' ', 'T') + 'Z';
  }
  const date = new Date(str);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleTimeString('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit'
  });
}
