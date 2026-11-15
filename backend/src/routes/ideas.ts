import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { GeminiService } from '../services/gemini';

const ideasRouter = new Hono<{ Bindings: Env }>();

// Lấy danh sách ý tưởng
ideasRouter.get('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const status = c.req.query('status') || 'all';
  const ideas = await repo.getIdeas(status);
  return c.json({ success: true, data: ideas });
});

// Thêm ý tưởng thủ công
ideasRouter.post('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json();
  if (!body.topic) {
    return c.json({ success: false, message: 'Vui lòng nhập chủ đề ý tưởng' }, 400);
  }

  const ideaId = 'idea_' + Date.now();
  await repo.addIdea({
    id: ideaId,
    topic: body.topic,
    description: body.description,
    generated_by: 'user'
  });

  return c.json({ success: true, message: 'Đã thêm ý tưởng mới' });
});

// AI Brainstorm ý tưởng tự động
ideasRouter.post('/brainstorm', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json().catch(() => ({}));
  const theme = body.theme || 'Thể thao cầu lông phong trào, mẹo hay, kèo giao lưu, đời sống sân bãi';
  const count = parseInt(body.count || '5');

  const configs = await repo.getAllConfigs();
  const geminiKey = configs['gemini_api_key'] || c.env.GEMINI_API_KEY;
  const geminiModel = configs['gemini_model'] || c.env.GEMINI_MODEL || 'gemini-1.5-flash';

  try {
    const gemini = new GeminiService(geminiKey, geminiModel);
    const ideas = await gemini.brainstormIdeas({ theme, count });

    // Lưu các ý tưởng này vào CSDL
    for (const item of ideas) {
      await repo.addIdea({
        id: 'idea_ai_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
        topic: item.topic,
        description: item.description,
        generated_by: 'ai'
      });
    }

    const currentIdeas = await repo.getIdeas('pending');
    return c.json({
      success: true,
      message: `Đã tạo ${ideas.length} ý tưởng mới từ AI`,
      data: currentIdeas
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

// Cập nhật trạng thái ý tưởng (used, pending, archived)
ideasRouter.put('/:id/status', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const id = c.req.param('id');
  const body = await c.req.json();
  await repo.markIdeaStatus(id, body.status);
  return c.json({ success: true, message: 'Đã cập nhật trạng thái ý tưởng' });
});

// Xóa ý tưởng
ideasRouter.delete('/:id', async (c) => {
  const repo = new D1Repository(c.env.DB);
  await repo.deleteIdea(c.req.param('id'));
  return c.json({ success: true, message: 'Đã xóa ý tưởng' });
});

export { ideasRouter };
