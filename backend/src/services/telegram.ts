import { Env } from '../types/env';
import { Post } from '../types/models';

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramService {
  private botToken: string;
  private defaultChatId: string;

  constructor(botToken?: string, defaultChatId?: string) {
    this.botToken = botToken || '';
    this.defaultChatId = defaultChatId || '';
  }

  static fromEnv(env: Env, configToken?: string, configChatId?: string): TelegramService {
    const token = configToken || env.TELEGRAM_BOT_TOKEN || '';
    const chatId = configChatId || env.TELEGRAM_CHAT_ID || '';
    return new TelegramService(token, chatId);
  }

  async getMe(): Promise<{ id: number; is_bot: boolean; first_name: string; username: string }> {
    if (!this.botToken) {
      throw new Error('Chưa điền Telegram Bot Token');
    }
    const url = `https://api.telegram.org/bot${this.botToken}/getMe`;
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data: any = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(`Token Telegram Bot không hợp lệ (${data.error_code || response.status}): ${data.description || 'Không tìm thấy bot'}`);
    }
    return data.result;
  }

  async sendPostForReview(options: {
    post: Post;
    mediaUrl?: string | null;
    customChatId?: string;
  }): Promise<string> {
    if (!this.botToken) {
      throw new Error('Chưa cấu hình TELEGRAM_BOT_TOKEN.');
    }
    const chatId = options.customChatId || this.defaultChatId;
    if (!chatId) {
      throw new Error('Chưa cấu hình TELEGRAM_CHAT_ID.');
    }

    let { post, mediaUrl } = options;

    // Chuẩn hóa link ảnh Google Drive sang CDN direct link của Google nếu cần
    if (mediaUrl && (mediaUrl.includes('drive.google.com') || mediaUrl.includes('googleusercontent.com'))) {
      const match = mediaUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || mediaUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        mediaUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
      }
    }

    const messageCaption = `🏸 <b>BÀI ĐĂNG FB MỚI CẦN DUYỆT</b>\n` +
      `📅 Giờ tạo: ${new Date().toLocaleTimeString('vi-VN')} | ID: <code>${post.id}</code>\n\n` +
      `📝 <b>Nội dung:</b>\n${escapeHtml(post.content)}\n\n` +
      `👇 Vui lòng chọn thao tác bên dưới:`;

    const inlineKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Duyệt & Đăng ngay', callback_data: `approve:${post.id}` },
          { text: '🔄 Viết lại', callback_data: `regen:${post.id}` }
        ],
        [
          { text: '❌ Hủy bài', callback_data: `reject:${post.id}` }
        ]
      ]
    };

    const hasMedia = !!(mediaUrl && (mediaUrl.startsWith('http://') || mediaUrl.startsWith('https://')));

    // Trường hợp 1: Có ảnh và nội dung <= 1000 ký tự (giới hạn caption Telegram là 1024)
    if (hasMedia && messageCaption.length <= 1000) {
      try {
        const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: mediaUrl,
            caption: messageCaption,
            parse_mode: 'HTML',
            reply_markup: inlineKeyboard
          }),
          signal: AbortSignal.timeout(10000)
        });

        const result: any = await response.json();
        if (response.ok && result.ok) {
          return String(result.result.message_id);
        }
        console.warn('Telegram sendPhoto thất bại, chuyển sang gửi dạng text:', result.description);
      } catch (err: any) {
        console.warn('Lỗi gọi sendPhoto, chuyển sang gửi dạng text:', err.message);
      }
    }

    // Trường hợp 2: Có ảnh nhưng bài viết dài (> 1000 ký tự), gửi ảnh trước nếu được
    if (hasMedia && messageCaption.length > 1000) {
      try {
        await fetch(`https://api.telegram.org/bot${this.botToken}/sendPhoto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            photo: mediaUrl,
            caption: `🖼️ <i>Ảnh đính kèm cho bài viết ID: <code>${post.id}</code></i>`,
            parse_mode: 'HTML'
          }),
          signal: AbortSignal.timeout(8000)
        });
      } catch {
        // Bỏ qua nếu ảnh lỗi
      }
    }

    // Gửi tin nhắn text đầy đủ kèm các nút duyệt
    const response = await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageCaption,
        parse_mode: 'HTML',
        reply_markup: inlineKeyboard
      }),
      signal: AbortSignal.timeout(10000)
    });

    const result: any = await response.json();
    if (!response.ok || !result.ok) {
      this.handleTelegramError(result, chatId);
    }

    return String(result.result.message_id);
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    if (!this.botToken) return;
    const url = `https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`;
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          callback_query_id: callbackQueryId,
          text: text || 'Đang xử lý yêu cầu...',
          show_alert: false
        }),
        signal: AbortSignal.timeout(5000)
      });
    } catch {
      // Ignored
    }
  }

  async updateMessageStatus(options: {
    chatId: string | number;
    messageId: string | number;
    hasPhoto: boolean;
    statusText: string;
    linkUrl?: string;
  }): Promise<void> {
    if (!this.botToken) return;

    const { chatId, messageId, hasPhoto, statusText, linkUrl } = options;
    const replyMarkup = linkUrl ? {
      inline_keyboard: [
        [{ text: '🔗 Xem bài trên Facebook', url: linkUrl }]
      ]
    } : { inline_keyboard: [] };

    const url = hasPhoto
      ? `https://api.telegram.org/bot${this.botToken}/editMessageCaption`
      : `https://api.telegram.org/bot${this.botToken}/editMessageText`;

    const body: any = {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    };

    if (hasPhoto) {
      body.caption = statusText;
    } else {
      body.text = statusText;
    }

    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(8000)
      });
    } catch {
      // Ignored
    }
  }

  async sendReply(chatId: string | number, text: string): Promise<void> {
    if (!this.botToken) return;
    await fetch(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    }).catch(() => null);
  }

  async sendAlert(message: string, customChatId?: string): Promise<void> {
    if (!this.botToken) throw new Error('Chưa cấu hình Telegram Bot Token');
    const chatId = customChatId || this.defaultChatId;
    if (!chatId) throw new Error('Chưa cấu hình Telegram Chat ID');

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `🏸 <b>THÔNG BÁO TỪ HỆ THỐNG QUẢN LÝ FANPAGE</b>\n\n${message}`,
        parse_mode: 'HTML'
      }),
      signal: AbortSignal.timeout(10000)
    });

    const data: any = await response.json();
    if (!response.ok || !data.ok) {
      this.handleTelegramError(data, chatId);
    }
  }

  private handleTelegramError(data: any, chatId: string | number): never {
    const desc = data?.description || '';
    if (desc.includes("can't send messages to the bot")) {
      throw new Error(`Chat ID (${chatId}) là ID của chính Bot! Bot không thể gửi tin nhắn cho chính nó. Bạn cần mở Telegram, tìm bot @userinfobot hoặc @myidbot, bấm Start để lấy User ID cá nhân của bạn.`);
    }
    if (desc.includes("chat not found")) {
      throw new Error(`Không tìm thấy cuộc trò chuyện với Chat ID (${chatId}). Bạn cần mở Telegram, tìm bot của bạn và bấm START hoặc gửi 1 tin nhắn cho nó trước.`);
    }
    throw new Error(`Lỗi Telegram (${data?.error_code || 'Error'}): ${desc}`);
  }
}
