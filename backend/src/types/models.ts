export interface Fanpage {
  id: string;
  name: string;
  fb_page_id: string;
  access_token: string;
  is_active: number;
  created_at?: string;
}

export interface AppConfig {
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
}

export interface MediaItem {
  id: string;
  fanpage_id?: string;
  source_type: 'r2' | 'gdrive' | 'external_url' | 'telegram';
  file_name: string;
  r2_key?: string | null;
  public_url: string;
  tags?: string | null; // Phân tách bằng dấu phẩy
  usage_count: number;
  last_used_at?: string | null;
  created_at?: string;
}

export type PostStatus = 
  | 'draft' 
  | 'pending_approval' 
  | 'approved' 
  | 'publishing' 
  | 'published' 
  | 'rejected' 
  | 'failed';

export interface Post {
  id: string;
  fanpage_id: string;
  idea_id?: string | null;
  content: string;
  media_ids?: string | null;
  status: PostStatus;
  fb_post_id?: string | null;
  fb_post_url?: string | null;
  telegram_message_id?: string | null;
  error_message?: string | null;
  scheduled_for?: string | null;
  published_at?: string | null;
  created_at?: string;
  updated_at?: string;
  
  // Virtual / Populated fields
  media?: MediaItem[];
  idea?: Idea;
}

export interface Idea {
  id: string;
  fanpage_id?: string;
  topic: string;
  description?: string | null;
  status: 'pending' | 'used' | 'archived';
  generated_by: 'ai' | 'user';
  created_at?: string;
}

export interface ActivityLog {
  id: string;
  level: 'info' | 'warn' | 'error';
  action: string;
  details?: string;
  created_at?: string;
}
