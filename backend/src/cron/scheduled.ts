import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { GeminiService } from '../services/gemini';
import { TelegramService } from '../services/telegram';
import { Post } from '../types/models';

export async function handleScheduledEvent(event: ScheduledEvent, env: Env): Promise<void> {
  const repo = new D1Repository(env.DB);
  const configs = await repo.getAllConfigs();

  // Kiểm tra cấu hình bật/tắt tự động
  const autoPostEnabled = configs['auto_post_enabled'] !== '0';
  if (!autoPostEnabled && event.cron !== 'manual_trigger') {
    await repo.addLog('info', 'cron_skipped', 'Tự động tạo bài đang bị tắt trong cấu hình.');
    return;
  }

  // Nếu là trigger tự động từ Cron (không phải bấm nút chạy thử)
  if (event.cron !== 'manual_trigger') {
    const vnDate = new Date(Date.now() + 7 * 3600 * 1000);
    const dayOfWeek = vnDate.getUTCDay(); // 0: CN, 1: T2, ..., 6: T7
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Kiểm tra cấu hình ngày đăng (Tất cả, Ngày thường, Cuối tuần)
    const autoPostDays = configs['auto_post_days'] || 'all';
    if (autoPostDays === 'weekdays' && isWeekend) {
      await repo.addLog('info', 'cron_skipped_weekend', 'Bỏ qua vì cấu hình chỉ chạy vào ngày thường (T2 - T6).');
      return;
    }
    if (autoPostDays === 'weekends' && !isWeekend) {
      await repo.addLog('info', 'cron_skipped_weekday', 'Bỏ qua vì cấu hình chỉ chạy vào cuối tuần (T7 - CN).');
      return;
    }
  }

  try {
    await repo.addLog('info', 'cron_started', `Bắt đầu tiến trình tạo bài viết theo lịch: ${event.cron}`);

    // Lấy Fanpage mặc định
    const fanpage = await repo.getDefaultFanpage();
    const fanpageId = fanpage ? fanpage.id : 'default_page';

    // 1. Lấy ý tưởng từ kho (nếu có), nếu không có thì yêu cầu Gemini tự đề xuất
    let idea = await repo.getNextPendingIdea(fanpageId);
    let topic = idea ? idea.topic : '';
    let description = idea?.description || undefined;

    const geminiKey = configs['gemini_api_key'] || env.GEMINI_API_KEY;
    const geminiModel = configs['gemini_model'] || env.GEMINI_MODEL || 'gemini-1.5-flash';
    const gemini = new GeminiService(geminiKey, geminiModel);

    if (!topic) {
      // Tự động brainstorm 1 ý tưởng
      const brainstormed = await gemini.brainstormIdeas({ count: 1 });
      if (brainstormed.length > 0) {
        topic = brainstormed[0].topic;
        description = brainstormed[0].description;
      } else {
        topic = 'Kèo giao lưu cầu lông sôi động hôm nay tại sân';
      }
    }

    // 2. Gọi Gemini tạo bài viết hoàn chỉnh
    const tone = configs['default_tone'] || env.DEFAULT_TONE;
    const rules = configs['prompt_rules'];

    const generated = await gemini.generatePost({
      topic,
      description,
      tone,
      customRules: rules,
      systemPrompt: configs['system_prompt'],
      userPromptTemplate: configs['user_prompt_template'],
      courtName: configs['court_name'],
      courtPhone: configs['court_phone'],
      courtAddress: configs['court_address']
    });

    // 3. Tìm 1 hình ảnh phù hợp trong kho R2 theo tag hoặc lấy ngẫu nhiên
    const searchTag = generated.suggestedTags[0] || 'san_bai';
    let media = await repo.getRandomMedia(searchTag);
    if (!media) {
      media = await repo.getRandomMedia(); // Fallback ngẫu nhiên bất kỳ ảnh nào
    }

    // 4. Lưu bài viết vào D1 trạng thái 'pending_approval'
    const postId = 'post_' + Date.now();
    const newPost: Post = await repo.createPost({
      id: postId,
      fanpage_id: fanpageId,
      idea_id: idea ? idea.id : null,
      content: generated.content,
      media_ids: media ? media.id : null,
      status: 'pending_approval'
    });

    if (idea) {
      await repo.markIdeaStatus(idea.id, 'used');
    }
    if (media) {
      await repo.incrementMediaUsage(media.id);
    }

    // 5. Gửi thông báo đến Telegram để duyệt
    const telegramToken = configs['telegram_bot_token'] || env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = configs['telegram_chat_id'] || env.TELEGRAM_CHAT_ID;

    if (telegramToken && telegramChatId) {
      const telegram = new TelegramService(telegramToken, telegramChatId);
      const messageId = await telegram.sendPostForReview({
        post: newPost,
        mediaUrl: media ? media.public_url : null
      });

      await repo.updatePostStatus(postId, 'pending_approval', {
        telegram_message_id: messageId
      });
    }

    await repo.addLog('info', 'cron_post_created', {
      postId,
      topic,
      hasMedia: !!media,
      status: 'pending_approval'
    });

  } catch (error: any) {
    await repo.addLog('error', 'cron_failed', error.message || String(error));
    // Gửi cảnh báo Telegram nếu có thể
    const telegramToken = configs['telegram_bot_token'] || env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = configs['telegram_chat_id'] || env.TELEGRAM_CHAT_ID;
    if (telegramToken && telegramChatId) {
      const telegram = new TelegramService(telegramToken, telegramChatId);
      await telegram.sendAlert(`Tiến trình tự động tạo bài viết gặp lỗi:\n\`${error.message}\``);
    }
  }
}
