import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { TelegramService } from '../services/telegram';
import { FacebookService } from '../services/facebook';
import { GeminiService } from '../services/gemini';

const telegramWebhookRouter = new Hono<{ Bindings: Env }>();

telegramWebhookRouter.post('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();

  // 1. Xác thực Secret Token bảo vệ webhook (nếu có cấu hình)
  const configuredSecret = configs['telegram_webhook_secret'] || c.env.TELEGRAM_WEBHOOK_SECRET;
  const incomingSecret = c.req.header('X-Telegram-Bot-Api-Secret-Token');

  if (configuredSecret && incomingSecret && configuredSecret !== incomingSecret) {
    return c.text('Unauthorized', 401);
  }

  const update: any = await c.req.json().catch(() => null);
  if (!update) {
    return c.text('No payload', 400);
  }

  const telegramToken = configs['telegram_bot_token'] || c.env.TELEGRAM_BOT_TOKEN;
  const telegramChatId = configs['telegram_chat_id'] || c.env.TELEGRAM_CHAT_ID;
  const telegram = new TelegramService(telegramToken, telegramChatId);

  // 2. Xử lý sự kiện Callback Query từ nút bấm Inline Keyboard
  if (update.callback_query) {
    const cb = update.callback_query;
    const callbackId = cb.id;
    const data: string = cb.data || '';
    const message = cb.message;
    const messageId = message?.message_id;
    const chatId = message?.chat?.id;
    const hasPhoto = !!message?.photo;

    const [action, postId] = data.split(':');

    if (!postId) {
      await telegram.answerCallbackQuery(callbackId, 'Dữ liệu không hợp lệ');
      return c.json({ ok: true });
    }

    const post = await repo.getPostById(postId);
    if (!post) {
      await telegram.answerCallbackQuery(callbackId, 'Không tìm thấy bài viết trong CSDL');
      return c.json({ ok: true });
    }

    // A. XỬ LÝ NÚT: [✅ DUYỆT & ĐĂNG NGAY]
    if (action === 'approve') {
      if (post.status === 'published') {
        await telegram.answerCallbackQuery(callbackId, 'Bài viết này đã được đăng trước đó rồi!');
        return c.json({ ok: true });
      }

      // Tránh duplicate post nếu user bấm liên tiếp
      if (post.status === 'publishing') {
        await telegram.answerCallbackQuery(callbackId, 'Đang tiến hành đăng bài, vui lòng đợi...');
        return c.json({ ok: true });
      }

      await telegram.answerCallbackQuery(callbackId, 'Đang xuất bản bài viết lên Fanpage...');
      await repo.updatePostStatus(postId, 'publishing');

      try {
        const pageId = configs['fb_page_id'] || c.env.FB_PAGE_ID;
        const accessToken = configs['fb_page_access_token'] || c.env.FB_PAGE_ACCESS_TOKEN;

        if (!pageId || !accessToken) {
          throw new Error('Chưa cấu hình Facebook Page ID hoặc Token.');
        }

        const mediaUrls = (post.media || []).map(m => m.public_url);
        const fb = new FacebookService(pageId, accessToken);
        const result = await fb.publishPost({
          content: post.content,
          mediaUrls
        });

        await repo.updatePostStatus(postId, 'published', {
          fb_post_id: result.id,
          fb_post_url: result.postUrl
        });

        if (chatId && messageId) {
          await telegram.updateMessageStatus({
            chatId,
            messageId,
            hasPhoto,
            statusText: `✅ <b>ĐÃ ĐĂNG BÀI LÊN FANPAGE THÀNH CÔNG!</b>\n\n${post.content}`,
            linkUrl: result.postUrl
          });
        }

        await repo.addLog('info', 'telegram_approved_and_published', { postId, fbUrl: result.postUrl });
      } catch (error: any) {
        await repo.updatePostStatus(postId, 'failed', { error_message: error.message });
        await repo.addLog('error', 'telegram_publish_failed', { postId, error: error.message });
        await telegram.sendAlert(`Đăng bài viết ${postId} thất bại:\n${error.message}`, String(chatId));
      }

      return c.json({ ok: true });
    }

    // B. XỬ LÝ NÚT: [🔄 VIẾT LẠI]
    if (action === 'regen') {
      await telegram.answerCallbackQuery(callbackId, 'AI đang viết lại nội dung mới...');

      try {
        const geminiKey = configs['gemini_api_key'] || c.env.GEMINI_API_KEY;
        const geminiModel = configs['gemini_model'] || c.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const gemini = new GeminiService(geminiKey, geminiModel);

        const newPost = await gemini.generatePost({
          topic: 'Kèo giao lưu cầu lông sôi động tại sân',
          tone: configs['default_tone'] || c.env.DEFAULT_TONE,
          customRules: configs['prompt_rules'],
          systemPrompt: configs['system_prompt'],
          userPromptTemplate: configs['user_prompt_template'],
          courtName: configs['court_name'],
          courtPhone: configs['court_phone'],
          courtAddress: configs['court_address']
        });

        await repo.updatePostContent(postId, newPost.content);
        await repo.updatePostStatus(postId, 'pending_approval');

        if (chatId && messageId) {
          const updatedCaption = `🏸 <b>BÀI ĐĂNG FB MỚI (ĐÃ VIẾT LẠI)</b>\n` +
            `📅 Giờ cập nhật: ${new Date().toLocaleTimeString('vi-VN')} | ID: <code>${postId}</code>\n\n` +
            `📝 <b>Nội dung mới:</b>\n${newPost.content}\n\n` +
            `👇 Vui lòng chọn thao tác:`;

          // Gửi lại nội dung mới vào tin nhắn
          await telegram.updateMessageStatus({
            chatId,
            messageId,
            hasPhoto,
            statusText: updatedCaption
          });
        }

        await repo.addLog('info', 'telegram_regenerated', { postId });
      } catch (error: any) {
        await telegram.sendAlert(`Không thể viết lại nội dung: ${error.message}`, String(chatId));
      }

      return c.json({ ok: true });
    }

    // C. XỬ LÝ NÚT: [❌ HỦY BÀI]
    if (action === 'reject') {
      await telegram.answerCallbackQuery(callbackId, 'Đã hủy bài viết');
      await repo.updatePostStatus(postId, 'rejected');

      if (chatId && messageId) {
        await telegram.updateMessageStatus({
          chatId,
          messageId,
          hasPhoto,
          statusText: `❌ <b>BÀI VIẾT NÀY ĐÃ BỊ HỦY</b>\n\n(Nội dung đã hủy: ${post.content.substring(0, 100)}...)`
        });
      }

      await repo.addLog('info', 'telegram_rejected', { postId });
      return c.json({ ok: true });
    }
  }

  return c.json({ ok: true });
});

export { telegramWebhookRouter };
