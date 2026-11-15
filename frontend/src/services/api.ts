import { Post, MediaItem, Idea, DashboardSummary } from '../types';

const API_BASE = '/api';

export const api = {
  // Summary
  async getSummary(): Promise<DashboardSummary> {
    const res = await fetch(`${API_BASE}/settings/summary`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  // Posts
  async getPosts(status: string = 'all'): Promise<Post[]> {
    const res = await fetch(`${API_BASE}/posts?status=${status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async generatePost(data: { topic?: string; description?: string; tone?: string; media_id?: string }): Promise<Post> {
    const res = await fetch(`${API_BASE}/posts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async updatePost(id: string, data: { content: string; status?: string; media_ids?: string }): Promise<Post> {
    const res = await fetch(`${API_BASE}/posts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async publishPost(id: string): Promise<{ id: string; postUrl: string }> {
    const res = await fetch(`${API_BASE}/posts/${id}/publish`, {
      method: 'POST'
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async deletePost(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  // Media
  async getMedia(tag?: string): Promise<MediaItem[]> {
    const url = tag ? `${API_BASE}/media?tag=${encodeURIComponent(tag)}` : `${API_BASE}/media`;
    const res = await fetch(url);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async uploadMedia(file: File, tags: string = 'san_bai'): Promise<MediaItem> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tags', tags);

    const res = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      body: formData
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async importMediaUrl(url: string, tags: string, fileName?: string): Promise<MediaItem> {
    const res = await fetch(`${API_BASE}/media/import-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, tags, file_name: fileName })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async deleteMedia(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/media/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  // Ideas
  async getIdeas(status: string = 'all'): Promise<Idea[]> {
    const res = await fetch(`${API_BASE}/ideas?status=${status}`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async addIdea(topic: string, description?: string): Promise<void> {
    const res = await fetch(`${API_BASE}/ideas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic, description })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async brainstormIdeas(theme?: string, count: number = 5): Promise<Idea[]> {
    const res = await fetch(`${API_BASE}/ideas/brainstorm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme, count })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async updateIdeaStatus(id: string, status: string): Promise<void> {
    const res = await fetch(`${API_BASE}/ideas/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async deleteIdea(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/ideas/${id}`, { method: 'DELETE' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  // Settings
  async getSettings(): Promise<Record<string, string>> {
    const res = await fetch(`${API_BASE}/settings`);
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.data;
  },

  async saveSettings(configs: Record<string, string>): Promise<void> {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configs)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
  },

  async testTelegram(data?: { token?: string; chatId?: string }): Promise<string> {
    const res = await fetch(`${API_BASE}/settings/test-telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {})
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.message;
  },

  async testFacebook(): Promise<string> {
    const res = await fetch(`${API_BASE}/settings/test-facebook`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.message;
  },

  async testGemini(): Promise<{ message: string; preview: string; model?: string }> {
    const res = await fetch(`${API_BASE}/settings/test-gemini`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return { message: json.message, preview: json.preview, model: json.model };
  },

  async triggerCron(): Promise<string> {
    const res = await fetch(`${API_BASE}/settings/trigger-cron`, { method: 'POST' });
    const json = await res.json();
    if (!json.success) throw new Error(json.message);
    return json.message;
  }
};
