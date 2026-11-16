/**
 * Service tích hợp Google Drive thông qua Google Apps Script Webhook.
 * Cho phép Cloudflare Worker tải ảnh lên Drive và quét danh sách ảnh trong Folder mà không cần Google Cloud Console.
 */
export class GoogleDriveService {
  private scriptUrl: string;

  constructor(scriptUrl?: string) {
    this.scriptUrl = scriptUrl ? scriptUrl.trim() : '';
  }

  isConfigured(): boolean {
    return !!this.scriptUrl && this.scriptUrl.startsWith('https://script.google.com/');
  }

  /**
   * Tải 1 file ảnh (dạng base64) lên thư mục Google Drive
   */
  async uploadFile(options: {
    fileName: string;
    mimeType: string;
    base64: string;
  }): Promise<{ success: boolean; fileId?: string; url?: string; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Chưa cấu hình Google Apps Script URL' };
    }

    try {
      const res = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          fileName: options.fileName,
          mimeType: options.mimeType,
          base64: options.base64
        })
      });

      const json: any = await res.json().catch(() => null);
      if (!json || !json.success) {
        return { success: false, error: json?.error || 'Lỗi không xác định từ Google Drive Script' };
      }

      return {
        success: true,
        fileId: json.fileId,
        url: json.url || `https://lh3.googleusercontent.com/d/${json.fileId}`
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  /**
   * Quét toàn bộ danh sách file ảnh đang có trong Thư mục Google Drive
   */
  async listFiles(): Promise<{ success: boolean; files?: Array<{ id: string; name: string; url: string; mimeType: string }>; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Chưa cấu hình Google Apps Script URL' };
    }

    try {
      const res = await fetch(this.scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' })
      });

      const json: any = await res.json().catch(() => null);
      if (!json || !json.success) {
        return { success: false, error: json?.error || 'Không thể lấy danh sách file từ Drive' };
      }

      return {
        success: true,
        files: json.files || []
      };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }
}
