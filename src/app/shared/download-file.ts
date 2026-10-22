/** Lưu Blob từ request có xác thực; không mở trực tiếp URL API trong tab mới. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Cho trình duyệt nhận download trước khi giải phóng URL tạm.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
