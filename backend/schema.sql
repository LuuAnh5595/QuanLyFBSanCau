-- CSDL SQLite cho Cloudflare D1
-- Hệ thống Quản lý Bài đăng Facebook Fanpage Sân Cầu

-- 1. Bảng Fanpages (Hỗ trợ 1 Fanpage hiện tại & mở rộng nhiều Fanpage sau này)
CREATE TABLE IF NOT EXISTS fanpages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fb_page_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Bảng Cấu hình Hệ thống (Key-Value)
CREATE TABLE IF NOT EXISTS configs (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Bảng Kho Ảnh / Media (Cloudflare R2 + Google Drive)
CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    fanpage_id TEXT,
    source_type TEXT NOT NULL, -- 'r2' | 'gdrive' | 'external_url'
    file_name TEXT NOT NULL,
    r2_key TEXT,
    public_url TEXT NOT NULL,
    tags TEXT,                 -- Ví dụ: 'san_bai,giao_luu,khuyen_mai,ky_thuat'
    usage_count INTEGER DEFAULT 0,
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fanpage_id) REFERENCES fanpages(id)
);

-- 4. Bảng Kho Ý Tưởng Nội Dung (Idea Backlog)
CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    fanpage_id TEXT,
    topic TEXT NOT NULL,       -- Ví dụ: 'Tìm kèo giao lưu tối thứ 6', 'Mẹo chọn độ căng cước vợt'
    description TEXT,
    status TEXT DEFAULT 'pending', -- 'pending' | 'used' | 'archived'
    generated_by TEXT DEFAULT 'ai', -- 'ai' | 'user'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fanpage_id) REFERENCES fanpages(id)
);

-- 5. Bảng Quản lý Bài Đăng & Lịch Sử (Posts)
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    fanpage_id TEXT NOT NULL,
    idea_id TEXT,
    content TEXT NOT NULL,
    media_ids TEXT,            -- Danh sách ID ảnh cách nhau bởi dấu phẩy
    status TEXT DEFAULT 'draft', 
    -- Statuses: 'draft' | 'pending_approval' | 'approved' | 'publishing' | 'published' | 'rejected' | 'failed'
    fb_post_id TEXT,
    fb_post_url TEXT,
    telegram_message_id TEXT,
    error_message TEXT,
    scheduled_for DATETIME,
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(fanpage_id) REFERENCES fanpages(id),
    FOREIGN KEY(idea_id) REFERENCES ideas(id)
);

-- 6. Bảng Nhật Ký Lịch Sử Hoạt Động (Activity Logs)
CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    level TEXT DEFAULT 'info', -- 'info' | 'warn' | 'error'
    action TEXT NOT NULL,      -- 'cron_generate', 'telegram_approved', 'fb_published', 'media_uploaded'
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Khởi tạo dữ liệu cấu hình mặc định nếu chưa có
INSERT OR IGNORE INTO configs (key, value, description) VALUES 
('auto_post_enabled', '1', 'Bật/Tắt chế độ tự động viết bài theo lịch cron (1: Bật, 0: Tắt)'),
('gemini_api_key', '', 'Google Gemini API Key'),
('gemini_model', 'gemini-1.5-flash', 'Model Gemini sử dụng'),
('telegram_bot_token', '', 'Telegram Bot Token từ @BotFather'),
('telegram_chat_id', '', 'Telegram Chat ID hoặc Group ID nhận thông báo'),
('telegram_webhook_secret', 'telegram_secret_token_123', 'Secret token bảo vệ webhook Telegram'),
('fb_page_id', '', 'Facebook Page ID'),
('fb_page_access_token', '', 'Facebook Page Long-lived Access Token'),
('default_tone', 'năng động, hào hứng, tự nhiên, thân thiện', 'Tone giọng bài viết AI'),
('prompt_rules', 'Sử dụng tiếng Việt tự nhiên, emoji phong phú, có hashtag #caulong #badminton #sancau và kêu gọi đặt sân/giao lưu', 'Quy tắc hướng dẫn cho AI khi tạo bài'),
('admin_password', 'admin123', 'Mật khẩu đăng nhập Web Dashboard');

-- Khởi tạo 1 Fanpage mặc định
INSERT OR IGNORE INTO fanpages (id, name, fb_page_id, access_token, is_active) VALUES
('default_page', 'Fanpage Sân Cầu Lông', '', '', 1);

-- Khởi tạo một số ý tưởng mẫu ban đầu cho Sân Cầu
INSERT OR IGNORE INTO ideas (id, fanpage_id, topic, description, status, generated_by) VALUES
('idea_1', 'default_page', 'Kèo giao lưu cầu lông tối nay - Tuyển đồng đội mọi trình độ', 'Bài viết tìm kiếm đồng đội giao lưu, tạo không khí thể thao vui tươi', 'pending', 'user'),
('idea_2', 'default_page', 'Mẹo khởi động kỹ khớp cổ tay & gối trước khi vào sân đập cầu', 'Chia sẻ kiến thức thể thao, phòng tránh chấn thương cho lông thủ', 'pending', 'user'),
('idea_3', 'default_page', 'Thông báo khung giờ vàng sân trống cuối tuần - Ưu đãi đặt cố định', 'Kêu gọi lông thủ nhanh tay giữ sân giờ đẹp', 'pending', 'user'),
('idea_4', 'default_page', 'Nên căng cước vợt bao nhiêu lbs để vừa bền vừa trợ lực tốt?', 'Thảo luận kỹ thuật, kích thích tương tác bình luận', 'pending', 'user');
