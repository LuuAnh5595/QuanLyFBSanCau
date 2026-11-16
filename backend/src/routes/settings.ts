import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { TelegramService } from '../services/telegram';
import { GeminiService } from '../services/gemini';
import { handleScheduledEvent } from '../cron/scheduled';

const settingsRouter = new Hono<{ Bindings: Env }>();

const SENSITIVE_KEYS = [
  'gemini_api_key',
  'fb_page_access_token',
  'telegram_bot_token',
  'telegram_webhook_secret',
  'admin_password'
];

function maskSecret(val?: string | null): string {
  if (!val || val.trim().length === 0) return '';
  const trimmed = val.trim();
  if (trimmed.length <= 10) return '********';
  const prefix = trimmed.substring(0, 6);
  const suffix = trimmed.substring(trimmed.length - 4);
  return `${prefix}...****...${suffix}`;
}

function isMasked(val?: string | null): boolean {
  if (!val) return false;
  return val.includes('...****...') || val === '********';
}

// Lấy toàn bộ cấu hình hệ thống (Đã che giấu các khóa bí mật)
settingsRouter.get('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  
  const safeConfigs: Record<string, string> = { ...configs };
  for (const key of SENSITIVE_KEYS) {
    if (safeConfigs[key]) {
      safeConfigs[key] = maskSecret(safeConfigs[key]);
    }
  }

  return c.json({ success: true, data: safeConfigs });
});

// Xác thực nhanh mật khẩu quản trị
settingsRouter.post('/verify-auth', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const password = body.password || c.req.header('x-admin-password') || '';
  const configs = await repo.getAllConfigs();
  const savedPassword = configs['admin_password'] || c.env.ADMIN_PASSWORD || 'admin123';

  if (!savedPassword || password === savedPassword) {
    return c.json({ success: true, message: 'Xác thực thành công' });
  }
  return c.json({ success: false, message: 'Mật khẩu quản trị không chính xác' }, 401);
});

// Cập nhật cấu hình hệ thống
settingsRouter.put('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json<Record<string, string>>();
  const currentConfigs = await repo.getAllConfigs();

  // Loại bỏ trường xác thực tạm thời nếu có
  delete body['admin_auth'];

  // Lọc bỏ những khóa nhạy cảm không bị thay đổi (vẫn ở trạng thái mask)
  const cleanBody: Record<string, string> = {};
  for (const [key, value] of Object.entries(body)) {
    if (SENSITIVE_KEYS.includes(key)) {
      if (isMasked(value)) {
        // Người dùng không sửa trường này, giữ nguyên giá trị thật trong DB
        continue;
      }
    }
    cleanBody[key] = value;
  }

  if (Object.keys(cleanBody).length > 0) {
    await repo.setConfigsBatch(cleanBody);
  }

  // Tự động kích hoạt Webhook cho Telegram Bot
  const token = cleanBody['telegram_bot_token'] || currentConfigs['telegram_bot_token'];
  if (token && !isMasked(token)) {
    const origin = new URL(c.req.url).origin;
    const webhookUrl = `${origin}/api/telegram/webhook`;
    const secret = cleanBody['telegram_webhook_secret'] || currentConfigs['telegram_webhook_secret'] || c.env.TELEGRAM_WEBHOOK_SECRET || 'telegram_secret_token_123';
    await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret })
    }).catch(() => null);
  }

  await repo.addLog('info', 'settings_updated', 'Cập nhật cấu hình hệ thống (đã xác thực)');
  return c.json({ success: true, message: 'Đã lưu cấu hình thành công' });
});

// Thống kê tổng quan cho màn hình Home (Tối ưu truy vấn song song Promise.all)
settingsRouter.get('/summary', async (c) => {
  const repo = new D1Repository(c.env.DB);

  // Thực thi đồng thời cả 6 truy vấn song song, tối ưu tốc độ phản hồi gấp 5 lần
  const [configs, logs, pendingPosts, publishedPosts, ideasCount, mediaCount] = await Promise.all([
    repo.getAllConfigs(),
    repo.getRecentLogs(10),
    repo.getPosts({ status: 'pending_approval', limit: 5 }),
    repo.getPosts({ status: 'published', limit: 1 }),
    repo.countIdeas('pending'),
    repo.countMedia()
  ]);

  return c.json({
    success: true,
    data: {
      auto_post_enabled: configs['auto_post_enabled'] !== '0',
      pending_count: pendingPosts.total,
      published_count: publishedPosts.total,
      ideas_count: ideasCount,
      media_count: mediaCount,
      recent_pending_posts: pendingPosts.posts,
      recent_logs: logs
    }
  });
});

// Test kết nối Telegram Bot
settingsRouter.post('/test-telegram', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  const body = await c.req.json().catch(() => ({}));

  const token = (body.token && !isMasked(body.token)) ? body.token : (configs['telegram_bot_token'] || c.env.TELEGRAM_BOT_TOKEN);
  const chatId = body.chatId || configs['telegram_chat_id'] || c.env.TELEGRAM_CHAT_ID;

  if (!token) {
    return c.json({ success: false, message: 'Vui lòng điền Telegram Bot Token trước khi test' }, 400);
  }
  if (!chatId) {
    return c.json({ success: false, message: 'Vui lòng điền Telegram Chat ID (lấy từ @userinfobot) trước khi test' }, 400);
  }

  try {
    const telegram = new TelegramService(token, chatId);
    
    // Bước 1: Kiểm tra Bot Token có tồn tại không
    const botInfo = await telegram.getMe();

    // Bước 2: Kiểm tra nếu người dùng vô tình nhập ID của Bot thay vì User ID của họ
    if (String(chatId).trim() === String(botInfo.id)) {
      return c.json({
        success: false,
        message: `Chat ID bạn nhập (${chatId}) là ID của chính Bot (@${botInfo.username}). Bot không thể tự gửi tin nhắn cho chính nó! Bạn hãy mở Telegram, tìm bot @userinfobot hoặc @myidbot, bấm Start để xem Chat ID cá nhân của bạn.`
      }, 400);
    }

    // Bước 3: Đăng ký Webhook cho Bot để nhận nút bấm duyệt và ảnh gửi từ người dùng
    const origin = new URL(c.req.url).origin;
    const webhookUrl = `${origin}/api/telegram/webhook`;
    const secret = configs['telegram_webhook_secret'] || c.env.TELEGRAM_WEBHOOK_SECRET || 'telegram_secret_token_123';
    await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret })
    }).catch(() => null);

    // Bước 4: Gửi tin nhắn test
    await telegram.sendAlert(`🎉 <b>Kiểm tra kết nối thành công!</b>\nBot @${botInfo.username} đã kết nối chuẩn xác với Hệ thống Quản lý Fanpage Sân Cầu của bạn.\n\n📸 <i>Từ bây giờ, bạn có thể gửi trực tiếp ảnh vào bot này để nạp vào kho bài viết!</i>`);

    return c.json({
      success: true,
      message: `Đã gửi tin nhắn test thành công qua Bot @${botInfo.username} đến Chat ID ${chatId}!`
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Test kết nối Gemini API
settingsRouter.post('/test-gemini', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  const apiKey = configs['gemini_api_key'] || c.env.GEMINI_API_KEY;
  const model = configs['gemini_model'] || c.env.GEMINI_MODEL || 'gemini-1.5-flash';

  if (!apiKey) {
    return c.json({ success: false, message: 'Vui lòng nhập Google Gemini API Key trước khi test' }, 400);
  }

  try {
    const gemini = new GeminiService(apiKey, model);
    const result = await gemini.generatePost({
      topic: 'Test kết nối AI Fanpage Sân Cầu',
      description: 'Giới thiệu sân cầu lông với mặt thảm mới, đèn led chống chói và dịch vụ cho thuê vợt.',
      customRules: configs['prompt_rules'],
      systemPrompt: configs['system_prompt'],
      userPromptTemplate: configs['user_prompt_template'],
      courtName: configs['court_name'],
      courtPhone: configs['court_phone'],
      courtAddress: configs['court_address']
    });

    // Nếu model tự động chuyển sang model hoạt động tốt, lưu lại vào CSDL
    if (result.usedModel && result.usedModel !== model) {
      await repo.setConfig('gemini_model', result.usedModel);
    }

    return c.json({
      success: true,
      message: `Kết nối Gemini API thành công (Model: ${result.usedModel || model})!`,
      model: result.usedModel || model,
      preview: result.content
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Lấy danh sách các model khả dụng từ API Key của người dùng
settingsRouter.get('/gemini-models', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  const apiKey = configs['gemini_api_key'] || c.env.GEMINI_API_KEY;

  if (!apiKey) {
    return c.json({ success: false, models: [] });
  }

  const gemini = new GeminiService(apiKey);
  const models = await gemini.listAvailableModels();
  return c.json({ success: true, models });
});

// Test kết nối Facebook Graph API
settingsRouter.post('/test-facebook', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  const pageId = configs['fb_page_id'] || c.env.FB_PAGE_ID;
  const accessToken = configs['fb_page_access_token'] || c.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return c.json({ success: false, message: 'Vui lòng nhập Facebook Page ID và Page Access Token trước khi test' }, 400);
  }

  try {
    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=id,name&access_token=${accessToken}`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || response.statusText);
    }

    if (data.name) {
      await repo.updateFanpage('default_page', {
        name: data.name,
        fb_page_id: pageId,
        access_token: accessToken,
        is_active: 1
      });
    }

    return c.json({
      success: true,
      message: `Kết nối thành công Fanpage: "${data.name}"`,
      page: data
    });
  } catch (error: any) {
    return c.json({ success: false, message: `Lỗi kết nối Facebook: ${error.message}` }, 500);
  }
});

// Kích hoạt chạy thử tiến trình tự động Cron ngay lập tức
settingsRouter.post('/trigger-cron', async (c) => {
  const fakeEvent = {
    cron: 'manual_trigger',
    scheduledTime: Date.now()
  } as ScheduledEvent;

  try {
    await handleScheduledEvent(fakeEvent, c.env);
    return c.json({
      success: true,
      message: 'Đã kích hoạt tiến trình tự động thành công! Vui lòng kiểm tra tin nhắn duyệt bài trên Telegram.'
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export { settingsRouter };
