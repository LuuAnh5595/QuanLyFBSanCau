import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { GeminiService } from '../services/gemini';
import { TelegramService } from '../services/telegram';
import { FacebookService } from '../services/facebook';

const postsRouter = new Hono<{ Bindings: Env }>();

// Danh sách bài đăng
postsRouter.get('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const status = c.req.query('status') || 'all';
  const limit = parseInt(c.req.query('limit') || '20');
  const offset = parseInt(c.req.query('offset') || '0');

  const result = await repo.getPosts({ status, limit, offset });
  return c.json({ success: true, data: result.posts, total: result.total });
});

// Chi tiết 1 bài đăng
postsRouter.get('/:id', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const post = await repo.getPostById(c.req.param('id'));
  if (!post) {
    return c.json({ success: false, message: 'Không tìm thấy bài viết' }, 404);
  }
  return c.json({ success: true, data: post });
});

// Trigger AI viết bài thủ công từ Web UI
postsRouter.post('/generate', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const configs = await repo.getAllConfigs();

  const topic = body.topic || 'Kèo giao lưu cầu lông sôi nổi hôm nay';
  const description = body.description || '';
  const tone = body.tone || configs['default_tone'] || c.env.DEFAULT_TONE;
  const autoSendTelegram = body.send_telegram !== false;
  const selectedMediaId = body.media_id;

  try {
    const geminiKey = configs['gemini_api_key'] || c.env.GEMINI_API_KEY;
    const geminiModel = configs['gemini_model'] || c.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const gemini = new GeminiService(geminiKey, geminiModel);

    const generated = await gemini.generatePost({
      topic,
      description,
      tone,
      customRules: configs['prompt_rules'],
      systemPrompt: configs['system_prompt'],
      userPromptTemplate: configs['user_prompt_template'],
      courtName: configs['court_name'],
      courtPhone: configs['court_phone'],
      courtAddress: configs['court_address']
    });

    if (generated.usedModel && generated.usedModel !== geminiModel) {
      await repo.setConfig('gemini_model', generated.usedModel);
    }

    // Chọn ảnh
    let media = null;
    if (selectedMediaId) {
      media = await repo.getMediaById(selectedMediaId);
    } else {
      const searchTag = generated.suggestedTags[0] || 'san_bai';
      media = await repo.getRandomMedia(searchTag) || await repo.getRandomMedia();
    }

    const fanpage = await repo.getDefaultFanpage();
    const fanpageId = fanpage ? fanpage.id : 'default_page';
    const postId = 'post_' + Date.now();

    const post = await repo.createPost({
      id: postId,
      fanpage_id: fanpageId,
      content: generated.content,
      media_ids: media ? media.id : null,
      status: 'pending_approval'
    });

    if (media) {
      await repo.incrementMediaUsage(media.id);
    }

    // Gửi Telegram nếu được bật
    let telegramMsgId: string | undefined;
    if (autoSendTelegram) {
      const telegramToken = configs['telegram_bot_token'] || c.env.TELEGRAM_BOT_TOKEN;
      const telegramChatId = configs['telegram_chat_id'] || c.env.TELEGRAM_CHAT_ID;
      if (telegramToken && telegramChatId) {
        const telegram = new TelegramService(telegramToken, telegramChatId);
        telegramMsgId = await telegram.sendPostForReview({
          post,
          mediaUrl: media ? media.public_url : null
        });
        await repo.updatePostStatus(postId, 'pending_approval', {
          telegram_message_id: telegramMsgId
        });
      }
    }

    await repo.addLog('info', 'manual_post_generated', { postId, topic });

    const fullPost = await repo.getPostById(postId);
    return c.json({ success: true, message: 'Đã tạo bài viết bằng AI thành công', data: fullPost });
  } catch (error: any) {
    await repo.addLog('error', 'manual_generate_failed', error.message);
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Chỉnh sửa bài đăng
postsRouter.put('/:id', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();

  const post = await repo.getPostById(id);
  if (!post) {
    return c.json({ success: false, message: 'Không tìm thấy bài viết' }, 404);
  }

  await repo.updatePostContent(id, body.content, body.media_ids);
  if (body.status && body.status !== post.status) {
    await repo.updatePostStatus(id, body.status);
  }

  const updated = await repo.getPostById(id);
  return c.json({ success: true, message: 'Đã cập nhật bài viết', data: updated });
});

// Xóa bài đăng
postsRouter.delete('/:id', async (c) => {
  const repo = new D1Repository(c.env.DB);
  await repo.deletePost(c.req.param('id'));
  return c.json({ success: true, message: 'Đã xóa bài viết' });
});

// Đăng trực tiếp lên Facebook qua API
postsRouter.post('/:id/publish', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const id = c.req.param('id');
  const post = await repo.getPostById(id);

  if (!post) {
    return c.json({ success: false, message: 'Không tìm thấy bài viết' }, 404);
  }
  if (post.status === 'published') {
    return c.json({ success: false, message: 'Bài viết này đã được đăng trước đó' }, 400);
  }

  const configs = await repo.getAllConfigs();
  const pageId = configs['fb_page_id'] || c.env.FB_PAGE_ID;
  const accessToken = configs['fb_page_access_token'] || c.env.FB_PAGE_ACCESS_TOKEN;

  if (!pageId || !accessToken) {
    return c.json({ success: false, message: 'Chưa cấu hình Facebook Page ID hoặc Page Access Token trong Cài đặt' }, 400);
  }

  try {
    await repo.updatePostStatus(id, 'publishing');

    const mediaUrls = (post.media || []).map(m => m.public_url);
    const fbService = new FacebookService(pageId, accessToken);
    const result = await fbService.publishPost({
      content: post.content,
      mediaUrls
    });

    await repo.updatePostStatus(id, 'published', {
      fb_post_id: result.id,
      fb_post_url: result.postUrl
    });

    // Cập nhật tin nhắn Telegram nếu có
    const telegramToken = configs['telegram_bot_token'] || c.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = configs['telegram_chat_id'] || c.env.TELEGRAM_CHAT_ID;
    if (telegramToken && telegramChatId && post.telegram_message_id) {
      const telegram = new TelegramService(telegramToken, telegramChatId);
      await telegram.updateMessageStatus({
        chatId: telegramChatId,
        messageId: post.telegram_message_id,
        hasPhoto: mediaUrls.length > 0,
        statusText: `✅ **BÀI VIẾT ĐÃ ĐƯỢC ĐĂNG LÊN FACEBOOK THÀNH CÔNG!**\n\n${post.content}`,
        linkUrl: result.postUrl
      });
    }

    await repo.addLog('info', 'post_published', { postId: id, fbPostId: result.id, fbUrl: result.postUrl });
    return c.json({ success: true, message: 'Đăng bài lên Facebook thành công!', data: result });
  } catch (error: any) {
    await repo.updatePostStatus(id, 'failed', { error_message: error.message });
    await repo.addLog('error', 'publish_failed', { postId: id, error: error.message });
    return c.json({ success: false, message: error.message }, 500);
  }
});

export { postsRouter };
