import { Fanpage, AppConfig, MediaItem, Post, PostStatus, Idea, ActivityLog } from '../types/models';

export class D1Repository {
  constructor(private db: D1Database) {}

  // ==================== CONFIGS ====================
  async getConfig(key: string): Promise<string | null> {
    const row = await this.db.prepare('SELECT value FROM configs WHERE key = ?').bind(key).first<{ value: string }>();
    return row ? row.value : null;
  }

  async getAllConfigs(): Promise<Record<string, string>> {
    const { results } = await this.db.prepare('SELECT key, value FROM configs').all<{ key: string; value: string }>();
    const configs: Record<string, string> = {};
    for (const r of results || []) {
      configs[r.key] = r.value;
    }
    return configs;
  }

  async setConfig(key: string, value: string, description?: string): Promise<void> {
    await this.db.prepare(`
      INSERT INTO configs (key, value, description, updated_at) 
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value, 
        description = COALESCE(excluded.description, configs.description),
        updated_at = CURRENT_TIMESTAMP
    `).bind(key, value, description || null).run();
  }

  // ==================== FANPAGES ====================
  async getDefaultFanpage(): Promise<Fanpage | null> {
    const row = await this.db.prepare('SELECT * FROM fanpages WHERE is_active = 1 LIMIT 1').first<Fanpage>();
    return row || null;
  }

  async ensureDefaultFanpage(): Promise<void> {
    await this.db.prepare(`
      INSERT OR IGNORE INTO fanpages (id, name, fb_page_id, access_token, is_active)
      VALUES ('default_page', 'Fanpage Sân Cầu Lông', '', '', 1)
    `).run();
  }

  async getFanpageById(id: string): Promise<Fanpage | null> {
    return await this.db.prepare('SELECT * FROM fanpages WHERE id = ?').bind(id).first<Fanpage>();
  }

  // ==================== POSTS ====================
  async getPosts(options: { status?: string; limit?: number; offset?: number } = {}): Promise<{ posts: Post[]; total: number }> {
    const limit = options.limit || 20;
    const offset = options.offset || 0;
    let query = 'SELECT * FROM posts';
    const params: any[] = [];

    if (options.status && options.status !== 'all') {
      query += ' WHERE status = ?';
      params.push(options.status);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await this.db.prepare(query).bind(...params).all<Post>();
    
    // Count total
    let countQuery = 'SELECT COUNT(*) as count FROM posts';
    const countParams: any[] = [];
    if (options.status && options.status !== 'all') {
      countQuery += ' WHERE status = ?';
      countParams.push(options.status);
    }
    const countRow = await this.db.prepare(countQuery).bind(...countParams).first<{ count: number }>();

    const posts = results || [];
    const allMediaIds = new Set<string>();
    for (const p of posts) {
      if (p.media_ids) {
        p.media_ids.split(',').forEach(id => {
          const trimmed = id.trim();
          if (trimmed) allMediaIds.add(trimmed);
        });
      }
    }

    if (allMediaIds.size > 0) {
      const idArray = Array.from(allMediaIds);
      const placeholders = idArray.map(() => '?').join(',');
      const { results: mediaResults } = await this.db.prepare(
        `SELECT * FROM media WHERE id IN (${placeholders})`
      ).bind(...idArray).all<MediaItem>();

      const mediaMap = new Map<string, MediaItem>();
      (mediaResults || []).forEach(m => mediaMap.set(m.id, m));

      for (const p of posts) {
        if (p.media_ids) {
          const ids = p.media_ids.split(',').map(s => s.trim()).filter(Boolean);
          p.media = ids.map(id => mediaMap.get(id)).filter(Boolean) as MediaItem[];
        } else {
          p.media = [];
        }
      }
    } else {
      for (const p of posts) {
        p.media = [];
      }
    }

    return {
      posts,
      total: countRow ? countRow.count : 0
    };
  }

  async getPostById(id: string): Promise<Post | null> {
    const post = await this.db.prepare('SELECT * FROM posts WHERE id = ?').bind(id).first<Post>();
    if (!post) return null;

    // Populate media items
    if (post.media_ids) {
      const ids = post.media_ids.split(',').map(s => s.trim()).filter(Boolean);
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const { results } = await this.db.prepare(`SELECT * FROM media WHERE id IN (${placeholders})`).bind(...ids).all<MediaItem>();
        post.media = results || [];
      }
    }
    return post;
  }

  async createPost(post: Partial<Post> & { id: string; fanpage_id: string; content: string }): Promise<Post> {
    await this.ensureDefaultFanpage();
    await this.db.prepare(`
      INSERT INTO posts (id, fanpage_id, idea_id, content, media_ids, status, scheduled_for, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).bind(
      post.id,
      post.fanpage_id,
      post.idea_id || null,
      post.content,
      post.media_ids || null,
      post.status || 'draft',
      post.scheduled_for || null
    ).run();

    return (await this.getPostById(post.id))!;
  }

  async updatePostStatus(id: string, status: PostStatus, extra?: { fb_post_id?: string; fb_post_url?: string; error_message?: string; telegram_message_id?: string }): Promise<void> {
    const updates: string[] = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params: any[] = [status];

    if (extra?.fb_post_id !== undefined) {
      updates.push('fb_post_id = ?');
      params.push(extra.fb_post_id);
    }
    if (extra?.fb_post_url !== undefined) {
      updates.push('fb_post_url = ?');
      params.push(extra.fb_post_url);
    }
    if (extra?.error_message !== undefined) {
      updates.push('error_message = ?');
      params.push(extra.error_message);
    }
    if (extra?.telegram_message_id !== undefined) {
      updates.push('telegram_message_id = ?');
      params.push(extra.telegram_message_id);
    }
    if (status === 'published') {
      updates.push('published_at = CURRENT_TIMESTAMP');
    }

    params.push(id);
    await this.db.prepare(`UPDATE posts SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  async updatePostContent(id: string, content: string, media_ids?: string): Promise<void> {
    await this.db.prepare(`
      UPDATE posts 
      SET content = ?, media_ids = COALESCE(?, media_ids), updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(content, media_ids || null, id).run();
  }

  async deletePost(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  }

  // ==================== IDEAS ====================
  async getIdeas(status?: string): Promise<Idea[]> {
    let query = 'SELECT * FROM ideas';
    const params: any[] = [];
    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC';
    const { results } = await this.db.prepare(query).bind(...params).all<Idea>();
    return results || [];
  }

  async getNextPendingIdea(fanpage_id: string): Promise<Idea | null> {
    const row = await this.db.prepare(`
      SELECT * FROM ideas 
      WHERE (fanpage_id = ? OR fanpage_id IS NULL) AND status = 'pending' 
      ORDER BY created_at ASC LIMIT 1
    `).bind(fanpage_id).first<Idea>();
    return row || null;
  }

  async addIdea(idea: { id: string; fanpage_id?: string; topic: string; description?: string; generated_by?: 'ai' | 'user' }): Promise<void> {
    await this.ensureDefaultFanpage();
    await this.db.prepare(`
      INSERT INTO ideas (id, fanpage_id, topic, description, status, generated_by, created_at)
      VALUES (?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)
    `).bind(
      idea.id,
      idea.fanpage_id || 'default_page',
      idea.topic,
      idea.description || null,
      idea.generated_by || 'user'
    ).run();
  }

  async markIdeaStatus(id: string, status: 'pending' | 'used' | 'archived'): Promise<void> {
    await this.db.prepare('UPDATE ideas SET status = ? WHERE id = ?').bind(status, id).run();
  }

  async deleteIdea(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM ideas WHERE id = ?').bind(id).run();
  }

  // ==================== MEDIA ====================
  async getMediaList(options: { tag?: string; limit?: number } = {}): Promise<MediaItem[]> {
    const limit = options.limit || 50;
    let query = 'SELECT * FROM media';
    const params: any[] = [];
    if (options.tag) {
      query += ' WHERE tags LIKE ?';
      params.push(`%${options.tag}%`);
    }
    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const { results } = await this.db.prepare(query).bind(...params).all<MediaItem>();
    return results || [];
  }

  async getMediaById(id: string): Promise<MediaItem | null> {
    return await this.db.prepare('SELECT * FROM media WHERE id = ?').bind(id).first<MediaItem>();
  }

  async getRandomMedia(tag?: string): Promise<MediaItem | null> {
    let query = 'SELECT * FROM media WHERE (public_url NOT LIKE "%/folders/%" OR public_url IS NULL)';
    const params: any[] = [];
    if (tag) {
      query += ' AND tags LIKE ?';
      params.push(`%${tag}%`);
    }
    query += ' ORDER BY RANDOM() LIMIT 1';
    let row = await this.db.prepare(query).bind(...params).first<MediaItem>();

    // Nếu tìm theo tag không thấy, tự động fallback lấy ngẫu nhiên ảnh bất kỳ hợp lệ trong kho
    if (!row && tag) {
      row = await this.db.prepare(
        'SELECT * FROM media WHERE (public_url NOT LIKE "%/folders/%" OR public_url IS NULL) ORDER BY RANDOM() LIMIT 1'
      ).first<MediaItem>();
    }
    return row || null;
  }

  async addMedia(item: Omit<MediaItem, 'usage_count' | 'created_at'>): Promise<void> {
    await this.db.prepare(`
      INSERT INTO media (id, fanpage_id, source_type, file_name, r2_key, public_url, tags, usage_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `).bind(
      item.id,
      item.fanpage_id || 'default_page',
      item.source_type,
      item.file_name,
      item.r2_key || null,
      item.public_url,
      item.tags || null
    ).run();
  }

  async incrementMediaUsage(id: string): Promise<void> {
    await this.db.prepare(`
      UPDATE media 
      SET usage_count = usage_count + 1, last_used_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).bind(id).run();
  }

  async deleteMedia(id: string): Promise<void> {
    await this.db.prepare('DELETE FROM media WHERE id = ?').bind(id).run();
  }

  // ==================== ACTIVITY LOGS ====================
  async addLog(level: 'info' | 'warn' | 'error', action: string, details?: any): Promise<void> {
    const detailStr = typeof details === 'string' ? details : JSON.stringify(details);
    const id = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    await this.db.prepare(`
      INSERT INTO activity_logs (id, level, action, details, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(id, level, action, detailStr || null).run();
  }

  async getRecentLogs(limit: number = 30): Promise<ActivityLog[]> {
    const { results } = await this.db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?').bind(limit).all<ActivityLog>();
    return results || [];
  }
}
