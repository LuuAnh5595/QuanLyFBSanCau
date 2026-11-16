import { Post, MediaItem, Idea, DashboardSummary } from '../types';

export const getApiBase = (): string => {
  const custom = localStorage.getItem('custom_backend_url');
  if (custom && custom.trim()) {
    let clean = custom.trim().replace(/\/$/, '');
    if (!clean.endsWith('/api')) {
      clean += '/api';
    }
    return clean;
  }

  if (import.meta.env.VITE_API_BASE_URL) {
    let envUrl = (import.meta.env.VITE_API_BASE_URL as string).trim().replace(/\/$/, '');
    if (!envUrl.endsWith('/api')) {
      envUrl += '/api';
    }
    return envUrl;
  }

  // Tự động kết nối Backend Worker trên Cloudflare nếu đang chạy trên cloudflare workers
  if (typeof window !== 'undefined' && window.location.hostname.includes('workers.dev')) {
    return 'https://quan-ly-fb-san-cau.luutuananh050595.workers.dev/api';
  }

  return '/api';
};

async function fetchJson(url: string, options?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, options);
  } catch (err: any) {
    throw new Error(`Không thể kết nối đến máy chủ API (${url}): ${err.message}`);
  }

  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const text = await res.text();
    if (text.startsWith('<!doctype') || text.startsWith('<html')) {
      throw new Error(
        'Chưa kết nối được với Backend Worker! Cloudflare đang trả về trang HTML thay vì dữ liệu JSON. Bạn hãy nhập URL Cloudflare Worker vào ô thiết lập.'
      );
    }
    throw new Error(`Phản hồi máy chủ không hợp lệ (${res.status}): ${text.slice(0, 100)}`);
  }

  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Thao tác thất bại');
  return json;
}

export const api = {
  getBackendUrl(): string {
    return localStorage.getItem('custom_backend_url') || '';
  },

  setBackendUrl(url: string): void {
    if (!url.trim()) {
      localStorage.removeItem('custom_backend_url');
    } else {
      localStorage.setItem('custom_backend_url', url.trim());
    }
  },

  // Summary
  async getSummary(): Promise<DashboardSummary> {
    const json = await fetchJson(`${getApiBase()}/settings/summary`);
    return json.data;
  },

  // Posts
  async getPosts(status: string = 'all'): Promise<Post[]> {
    const json = await fetchJson(`${getApiBase()}/posts?status=${status}`);
    return json.data;
  },

  async generatePost(data: { topic?: string; description?: string; tone?: string; media_id?: string }): Promise<Post> {
    const json = await fetchJson(`${getApiBase()}/posts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async updatePost(id: string, data: { content: string; status?: string; media_ids?: string }): Promise<Post> {
    const json = await fetchJson(`${getApiBase()}/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return json.data;
  },

  async publishPost(id: string): Promise<{ id: string; postUrl: string }> {
    const json = await fetchJson(`${getApiBase()}/posts/${id}/publish`, {
      method: 'POST'
    });
    return json.data;
  },

  async deletePost(id: string): Promise<void> {
    await fetchJson(`${getApiBase()}/posts/${id}`, { method: 'DELETE' });
  },

  // Media
  async getMedia(tag?: string): Promise<MediaItem[]> {
    const url = tag ? `${getApiBase()}/media?tag=${encodeURIComponent(tag)}` : `${getApiBase()}/media`;
    const json = await fetchJson(url);
    return json.data;
  },

  async uploadMedia(file: File, tags: string = 'san_bai'): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', tags);

    const res = await fetch(`${getApiBase()}/media/upload`, {
      method: 'POST',
      body: formData
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new Error('Chưa kết nối được với Backend Worker khi upload ảnh');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async importMediaUrl(url: string, tags: string = 'san_bai', fileName?: string): Promise<MediaItem> {
    const json = await fetchJson(`${getApiBase()}/media/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags, file_name: fileName })
    });
    return json.data;
  },

  async deleteMedia(id: string): Promise<void> {
    await fetchJson(`${getApiBase()}/media/${id}`, { method: 'DELETE' });
  },

  async syncGoogleDrive(): Promise<{ success: boolean; message: string; addedCount: number; totalCount: number }> {
    return await fetchJson(`${getApiBase()}/media/sync-gdrive`, { method: 'POST' });
  },

  // Ideas
  async getIdeas(status: string = 'all'): Promise<Idea[]> {
    const json = await fetchJson(`${getApiBase()}/ideas?status=${status}`);
    return json.data;
  },

  async addIdea(topic: string, description?: string): Promise<void> {
    await fetchJson(`${getApiBase()}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, description })
    });
  },

  async brainstormIdeas(theme?: string, count: number = 5): Promise<Idea[]> {
    const json = await fetchJson(`${getApiBase()}/ideas/brainstorm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, count })
    });
    return json.data;
  },

  async updateIdeaStatus(id: string, status: string): Promise<void> {
    await fetchJson(`${getApiBase()}/ideas/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  },

  async deleteIdea(id: string): Promise<void> {
    await fetchJson(`${getApiBase()}/ideas/${id}`, { method: 'DELETE' });
  },

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    const json = await fetchJson(`${getApiBase()}/settings`);
    return json.data;
  },

  async saveSettings(configs: Record<string, string>): Promise<void> {
    await fetchJson(`${getApiBase()}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configs)
    });
  },

  async testTelegram(data?: { token?: string; chatId?: string }): Promise<string> {
    const json = await fetchJson(`${getApiBase()}/settings/test-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
    return json.message;
  },

  async testFacebook(): Promise<string> {
    const json = await fetchJson(`${getApiBase()}/settings/test-facebook`, { method: 'POST' });
    return json.message;
  },

  async testGemini(): Promise<{ message: string; preview: string; model?: string }> {
    const json = await fetchJson(`${getApiBase()}/settings/test-gemini`, { method: 'POST' });
    return { message: json.message, preview: json.preview, model: json.model };
  },

  async triggerCron(): Promise<string> {
    const json = await fetchJson(`${getApiBase()}/settings/trigger-cron`, { method: 'POST' });
    return json.message;
  }
};
