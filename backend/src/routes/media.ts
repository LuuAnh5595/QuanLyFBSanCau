import { Hono } from 'hono';
import { Env } from '../types/env';
import { D1Repository } from '../db/repository';
import { GoogleDriveService } from '../services/googleDrive';

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
    return c.json({ success: false, message: 'Vui lòng chọn file hình ảnh hoặc video' }, 400);
  }

  const mediaId = 'media_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const isVideo = file.type?.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext);
  const r2Key = isVideo ? `videos/${mediaId}.${ext}` : `images/${mediaId}.${ext}`;

  let publicUrl = '';

  if (c.env.BUCKET) {
    // Lưu vào Cloudflare R2
    const defaultMime = isVideo ? 'video/mp4' : 'image/jpeg';
    await c.env.BUCKET.put(r2Key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type || defaultMime }
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
  const fileName = body.file_name || (rawUrl.toLowerCase().includes('.mp4') || rawUrl.toLowerCase().includes('.mov') ? 'Video kho lưu trữ' : 'Ảnh / Video Google Drive');

  if (!rawUrl) {
    return c.json({ success: false, message: 'Vui lòng cung cấp đường dẫn ảnh/video hoặc liên kết Google Drive' }, 400);
  }

  // Cảnh báo nếu người dùng nhập nhầm link Folder thay vì link file ảnh/video
  if (rawUrl.includes('/folders/')) {
    return c.json({
      success: false,
      message: 'Đường dẫn bạn nhập là liên kết Thư mục (Folder) Google Drive. Để AI lấy được ảnh/video, vui lòng mở thư mục trên Drive, nhấp chuột phải vào từng file > Chia sẻ > Sao chép liên kết rồi dán vào đây.'
    }, 400);
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

// Đồng bộ toàn bộ ảnh từ Google Drive Folder về D1
mediaRouter.post('/sync-gdrive', async (c) => {
  const repo = new D1Repository(c.env.DB);
  const configs = await repo.getAllConfigs();
  const scriptUrl = configs['gdrive_script_url'];

  if (!scriptUrl) {
    return c.json({
      success: false,
      message: 'Chưa cấu hình Google Apps Script Webhook trong Cài đặt hệ thống.'
    }, 400);
  }

  const gdrive = new GoogleDriveService(scriptUrl);
  const result = await gdrive.listFiles();

  if (!result.success || !result.files) {
    return c.json({ success: false, message: result.error || 'Lỗi khi quét thư mục Google Drive' }, 500);
  }

  const currentMedia = await repo.getMediaList({ limit: 500 });
  const existingUrls = new Set(currentMedia.map(m => m.public_url));

  let addedCount = 0;
  for (const file of result.files) {
    if (!existingUrls.has(file.url)) {
      const mediaId = 'media_gdrive_' + file.id;
      await repo.addMedia({
        id: mediaId,
        fanpage_id: 'default_page',
        source_type: 'gdrive',
        file_name: file.name || 'Ảnh Google Drive',
        public_url: file.url,
        tags: 'giao_luu'
      });
      existingUrls.add(file.url);
      addedCount++;
    }
  }

  await repo.addLog('info', 'gdrive_synced', { totalInDrive: result.files.length, newlyAdded: addedCount });

  return c.json({
    success: true,
    message: `Đã quét thấy ${result.files.length} ảnh trên Google Drive (Thêm mới ${addedCount} ảnh vào kho AI)!`,
    addedCount,
    totalCount: result.files.length
  });
});

export { mediaRouter };
