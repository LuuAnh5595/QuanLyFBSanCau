import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';

const mediaRouter = new Hono<{ Bindings: Env }>();

// Lấy danh sách ảnh
mediaRouter.get('/', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const tag = c.req.query('tag') || undefined;
  const limit = parseInt(c.req.query('limit') || '50');

  const mediaList = await repo.getMediaList({ tag, limit });
  return c.json({ success: true, data: mediaList });
});

// Upload ảnh trực tiếp lên Cloudflare R2
mediaRouter.post('/upload', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const tags = (formData.get('tags') as string) || 'san_bai';

  if (!file) {
    return c.json({ success: false, message: 'Vui lòng chọn file hình ảnh' }, 400);
  }

  const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const ext = file.name.split('.').pop() || 'jpg';
  const r2Key = `images/${mediaId}.${ext}`;

  let publicUrl = '';

  if (c.env.BUCKET) {
    // Lưu vào Cloudflare R2
    await c.env.BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || 'image/jpeg' }
    });

    const publicDomain = c.env.R2_PUBLIC_DOMAIN;
    if (publicDomain) {
      publicUrl = `${publicDomain.replace(/\/$/, '')}/${r2Key}`;
    } else {
      // Endpoint fallback qua worker
      const requestUrl = new URL(c.req.url);
      publicUrl = `${requestUrl.origin}/api/media/file/${r2Key}`;
    }
  } else {
    // Nếu chưa gán bucket R2 (local dev mock)
    const requestUrl = new URL(c.req.url);
    publicUrl = `${requestUrl.origin}/api/media/file/${r2Key}`;
  }

  await repo.addMedia({
    id: mediaId,
    source_type: 'r2',
    file_name: file.name,
    r2_key: r2Key,
    public_url: publicUrl,
    tags
  });

  const createdItem = await repo.getMediaById(mediaId);
  return c.json({ success: true, message: 'Tải ảnh lên thành công', data: createdItem });
});

// Import ảnh từ Google Drive hoặc URL bên ngoài
mediaRouter.post('/import-url', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const body = await c.req.json();
  const rawUrl = body.url;
  const tags = body.tags || 'san_bai';
  const fileName = body.file_name || 'Ảnh Google Drive';

  if (!rawUrl) {
    return c.json({ success: false, message: 'Vui lòng cung cấp đường dẫn ảnh hoặc liên kết Google Drive' }, 400);
  }

  let finalUrl = rawUrl;
  let sourceType: 'gdrive' | 'external_url' = 'external_url';

  // Chuyển đổi link chia sẻ Google Drive sang CDN trực tiếp chất lượng cao (lh3.googleusercontent.com/d/FILE_ID)
  // Hỗ trợ dạng:
  // - https://drive.google.com/file/d/FILE_ID/view...
  // - https://drive.google.com/open?id=FILE_ID
  // - https://drive.google.com/uc?export=view&id=FILE_ID
  if (rawUrl.includes('drive.google.com') || rawUrl.includes('googleusercontent.com')) {
    sourceType = 'gdrive';
    const driveMatch = rawUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || rawUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      const fileId = driveMatch[1];
      finalUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
    }
  }

  const mediaId = 'media_ext_' + Date.now();
  await repo.addMedia({
    id: mediaId,
    source_type: sourceType,
    file_name: fileName,
    public_url: finalUrl,
    tags
  });

  const item = await repo.getMediaById(mediaId);
  return c.json({ success: true, message: 'Đã thêm ảnh vào kho thành công', data: item });
});

// Xóa ảnh
mediaRouter.delete('/:id', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const id = c.req.param('id');
  const media = await repo.getMediaById(id);

  if (!media) {
    return c.json({ success: false, message: 'Không tìm thấy ảnh' }, 404);
  }

  // Xóa trên R2 nếu có
  if (media.r2_key && c.env.BUCKET) {
    await c.env.BUCKET.delete(media.r2_key);
  }

  await repo.deleteMedia(id);
  return c.json({ success: true, message: 'Đã xóa ảnh khỏi kho' });
});

// Endpoint phục vụ file ảnh trực tiếp từ R2 (nếu không dùng Custom Domain cho R2)
mediaRouter.get('/file/*', async (c) => {
  const path = c.req.path.replace('/api/media/file/', '');
  if (!c.env.BUCKET) {
    return c.text('R2 Bucket chưa được cấu hình', 404);
  }

  const object = await c.env.BUCKET.get(path);
  if (!object) {
    return c.text('Không tìm thấy file', 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', 'public, max-age=31536000');

  return new Response(object.body, { headers });
});

export { mediaRouter };
