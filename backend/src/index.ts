import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types/env';
import { postsRouter } from './routes/posts';
import { mediaRouter } from './routes/media';
import { ideasRouter } from './routes/ideas';
import { settingsRouter } from './routes/settings';
import { telegramWebhookRouter } from './routes/telegramWebhook';
import { handleScheduledEvent } from './cron/scheduled';

const app = new Hono<{ Bindings: Env }>();

// CORS Middleware cho phép Web UI gọi API
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Telegram-Bot-Api-Secret-Token', 'x-admin-password', 'X-Admin-Password'],
  maxAge: 86400,
}));

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'QuanLyFBSanCau Backend Worker',
    time: new Date().toISOString()
  });
});

// Mount Routes
app.route('/api/posts', postsRouter);
app.route('/api/media', mediaRouter);
app.route('/api/ideas', ideasRouter);
app.route('/api/settings', settingsRouter);
app.route('/api/telegram/webhook', telegramWebhookRouter);

// Global Error Handler
app.onError((err, c) => {
  console.error('Unhandled Server Error:', err);
  return c.json({
    success: false,
    message: err.message || 'Lỗi máy chủ nội bộ'
  }, 500);
});

export default {
  // HTTP Request Handler
  fetch: app.fetch,

  // Cloudflare Cron Trigger Handler
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(handleScheduledEvent(event, env));
  }
};
