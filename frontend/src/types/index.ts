export interface MediaItem {
  id: string;
  source_type: 'r2' | 'gdrive' | 'external_url';
  file_name: string;
  public_url: string;
  tags?: string;
  usage_count: number;
  last_used_at?: string;
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
  idea_id?: string;
  content: string;
  media_ids?: string;
  status: PostStatus;
  fb_post_id?: string;
  fb_post_url?: string;
  telegram_message_id?: string;
  error_message?: string;
  scheduled_for?: string;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  media?: MediaItem[];
}

export interface Idea {
  id: string;
  fanpage_id?: string;
  topic: string;
  description?: string;
  status: 'pending' | 'used' | 'archived';
  generated_by: 'ai' | 'user';
  created_at?: string;
}

export interface DashboardSummary {
  auto_post_enabled: boolean;
  pending_count: number;
  published_count: number;
  ideas_count: number;
  media_count: number;
  recent_pending_posts: Post[];
  recent_logs: Array<{
    id: string;
    level: string;
    action: string;
    details?: string;
    created_at: string;
  }>;
}
