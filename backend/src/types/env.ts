export interface Env {
  // Bindings từ Cloudflare
  DB: D1Database;
  BUCKET?: R2Bucket;

  // Environment Variables & Secrets
  ENVIRONMENT?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  FB_PAGE_ID?: string;
  FB_PAGE_ACCESS_TOKEN?: string;
  DEFAULT_TONE?: string;
  ADMIN_PASSWORD?: string;
  R2_PUBLIC_DOMAIN?: string;
}
