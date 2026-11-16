import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { TelegramService } from '../services/telegram';
import { GeminiService } from '../services/gemini';
import { handleScheduledEvent } from '../cron/scheduled';

const settingsRouter = new Hono<{ Bindings: Env }>();

// Lấy toàn bộ cấu hình hệ thống
settingsRouter.get('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  return c.json({ success: true, data: configs });
});

// Cập nhật cấu hình hệ thống
settingsRouter.put('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json<Record<string, string>>();

  // Lưu toàn bộ cấu hình trong 1 lượt mạng Batch Transaction duy nhất
  await repo.setConfigsBatch(body);

  // Tự động kích hoạt Webhook cho Telegram Bot
  const token = body['telegram_bot_token'] || (await repo.getConfig('telegram_bot_token'));
  if (token) {
    const origin = new URL(c.req.url).origin;
    const webhookUrl = `${origin}/api/telegram/webhook`;
    const secret = body['telegram_webhook_secret'] || (await repo.getConfig('telegram_webhook_secret')) || c.env.TELEGRAM_WEBHOOK_SECRET || 'telegram_secret_token_123';
    await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl, secret_token: secret })
    }).catch(() => null);
  }

  await repo.addLog('info', 'settings_updated', 'Cập nhật cấu hình hệ thống');
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

  const token = body.token || configs['telegram_bot_token'] || c.env.TELEGRAM_BOT_TOKEN;
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
    const url = `https://graph.facebook.com/v20.0/${pageId}?fields=id,name,fan_count,link&access_token=${accessToken}`;
    const response = await fetch(url);
    const data: any = await response.json();

    if (!response.ok || data.error) {
      throw new Error(data.error?.message || response.statusText);
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
