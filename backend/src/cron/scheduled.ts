import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { GeminiService } from '../services/gemini';
import { TelegramService } from '../services/telegram';
import { Post } from '../types/models';

/**
 * Lấy thông tin thời gian hiện tại chuẩn theo múi giờ Việt Nam (Asia/Ho_Chi_Minh, UTC+7)
 */
function getVietnamTimeInfo() {
  const now = new Date();

  // YYYY-MM-DD
  const dateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);

  // HH:mm (24-hour)
  const timeStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(now);

  const [hourStr, minuteStr] = timeStr.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const currentTotalMinutes = hour * 60 + minute;

  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    weekday: 'short'
  }).format(now);
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';

  return {
    dateStr,
    timeStr,
    hour,
    minute,
    currentTotalMinutes,
    weekday,
    isWeekend
  };
}

export async function handleScheduledEvent(event: ScheduledEvent, env: Env): Promise<void> {
  const repo = new D1Repository(env.DB);
  const configs = await repo.getAllConfigs();

  // 1. Kiểm tra cấu hình bật/tắt tự động
  const autoPostEnabled = configs['auto_post_enabled'] !== '0';
  if (!autoPostEnabled && event.cron !== 'manual_trigger') {
    return;
  }

  const vnTime = getVietnamTimeInfo();

  // 2. Nếu là trigger tự động từ Cron (không phải bấm nút test manual_trigger)
  if (event.cron !== 'manual_trigger') {
    // A. Kiểm tra cấu hình ngày đăng (Tất cả, Ngày thường, Cuối tuần)
    const autoPostDays = configs['auto_post_days'] || 'all';
    if (autoPostDays === 'weekdays' && vnTime.isWeekend) {
      return;
    }
    if (autoPostDays === 'weekends' && !vnTime.isWeekend) {
      return;
    }

    // B. Kiểm tra khung giờ đăng (auto_post_slots)
    const rawSlots = configs['auto_post_slots'] || '08:30, 14:30, 18:30';
    const slots = rawSlots.split(',').map(s => s.trim()).filter(Boolean);

    let matchedSlot: string | null = null;
    for (const slot of slots) {
      const match = slot.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) continue;
      const sH = parseInt(match[1], 10);
      const sM = parseInt(match[2], 10);
      const slotMinutes = sH * 60 + sM;

      // Khoảng cách thời gian: vì cron chạy đúng mốc :00 và :30,
      // Dùng ngưỡng 4 phút để bao phủ cả trường hợp Cloudflare kích hoạt trễ 1-2 phút.
      const diff = Math.abs(vnTime.currentTotalMinutes - slotMinutes);
      if (diff <= 4) {
        // Kiểm tra xem khung giờ này trong ngày hôm nay đã được tạo bài chưa
        const slotKey = `cron_done_${vnTime.dateStr}_${slot.replace(':', '')}`;
        if (configs[slotKey]) {
          // Khung giờ này hôm nay đã tạo bài rồi, không tạo trùng
          continue;
        }
        matchedSlot = slot;
        break;
      }
    }

    // Nếu thời điểm này không khớp khung giờ nào người dùng cài đặt -> Dừng lại ngay
    if (!matchedSlot) {
      return;
    }

    // Đánh dấu khung giờ này hôm nay đã xử lý xong
    const slotKey = `cron_done_${vnTime.dateStr}_${matchedSlot.replace(':', '')}`;
    await repo.setConfig(slotKey, '1');

    // C. Kiểm tra số bài tối đa trong ngày (auto_post_max_per_day)
    const maxPerDay = configs['auto_post_max_per_day'];
    if (maxPerDay && maxPerDay !== 'unlimited') {
      const maxCount = parseInt(maxPerDay, 10);
      const todayCountKey = `cron_count_${vnTime.dateStr}`;
      const currentCount = parseInt(configs[todayCountKey] || '0', 10);
      if (currentCount >= maxCount) {
        await repo.addLog('info', 'cron_limit_reached', `Đã đạt giới hạn tối đa ${maxCount} bài/ngày (Giờ VN: ${vnTime.timeStr}).`);
        return;
      }
      await repo.setConfig(todayCountKey, String(currentCount + 1));
    }
  }

  try {
    await repo.addLog('info', 'cron_started', `Bắt đầu tiến trình tạo bài viết theo lịch (Giờ VN: ${vnTime.timeStr} ngày ${vnTime.dateStr})`);

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
