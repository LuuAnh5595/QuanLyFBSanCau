# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG TRÊN CLOUDFLARE (DEPLOYMENT GUIDE)

Tài liệu này hướng dẫn chi tiết từng bước thiết lập và triển khai toàn bộ ứng dụng Quản lý Fanpage Sân Cầu bằng AI lên hệ sinh thái Cloudflare (Workers, D1, R2, Pages).

---

## BƯỚC 1: CHUẨN BỊ MÔI TRƯỜNG & CLOUDFLARE CLI

1. **Cài đặt Node.js & Wrangler CLI**:
   - Tải và cài đặt Node.js phiên bản LTS (v18 trở lên).
   - Đăng nhập tài khoản Cloudflare qua CLI:
     ```bash
     npx wrangler login
     ```

---

## BƯỚC 2: KHỞI TẠO CSDL CLOUDFLARE D1 & R2 BUCKET

1. **Tạo CSDL Cloudflare D1**:
   ```bash
   npx wrangler d1 create fb-san-cau-db
   ```
   *Lệnh này sẽ in ra `database_id` của bạn. Hãy copy `database_id` và dán vào file `backend/wrangler.toml` ở mục `[[d1_databases]]`:*
   ```toml
   [[d1_databases]]
   binding = "DB"
   database_name = "fb-san-cau-db"
   database_id = "<DÁN_DATABASE_ID_CỦA_BẠN_VÀO_ĐÂY>"
   ```

2. **Nạp Schema CSDL (Khởi tạo các bảng)**:
   - Chạy trên môi trường Local để test:
     ```bash
     cd backend
     npx wrangler d1 execute fb-san-cau-db --local --file=./schema.sql
     ```
   - Chạy trên Cloudflare Production:
     ```bash
     cd backend
     npx wrangler d1 execute fb-san-cau-db --remote --file=./schema.sql
     ```

3. **Tạo Bucket Lưu Ảnh Cloudflare R2**:
   ```bash
   npx wrangler r2 bucket create fb-san-cau-media
   ```

---

## BƯỚC 3: LẤY CÁC KHÓA API CẦN THIẾT

### 1. Google Gemini API Key (Miễn phí)
- Truy cập: [Google AI Studio](https://aistudio.google.com/app/apikey).
- Bấm **Create API Key** và copy khóa (dạng `AIzaSy...`).

### 2. Telegram Bot Token & Chat ID
1. Mở Telegram, tìm bot **@BotFather**, gửi lệnh `/newbot` và làm theo hướng dẫn để đặt tên.
2. BotFather sẽ gửi cho bạn **HTTP API Token** (dạng `7123456789:ABCdef...`).
3. Tìm bot **@userinfobot** trên Telegram và bấm Start để lấy **Id** cá nhân của bạn (dạng số như `123456789`).
4. Gửi một tin nhắn bất kỳ (ví dụ: "chao bot") cho con bot bạn vừa tạo để mở cuộc trò chuyện.

### 3. Facebook Fanpage ID & Page Access Token
1. **Lấy Page ID**: Vào Fanpage của bạn trên Facebook ➔ Giới thiệu (About) ➔ Kéo xuống tìm **ID Trang**.
2. **Lấy Long-lived Page Access Token**:
   - Truy cập: [Meta for Developers - Graph API Explorer](https://developers.facebook.com/tools/explorer/).
   - Chọn App của bạn, mục **User or Page** chọn Fanpage của bạn.
   - Thêm các quyền (Permissions): `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`.
   - Bấm **Generate Access Token**.
   - Dùng công cụ Access Token Debugger để đổi sang Token dài hạn (Never expires hoặc 60 ngày).

---

## BƯỚC 4: THIẾT LẬP TELEGRAM WEBHOOK CHO NÚT DUYỆT BÀI

Sau khi bạn deploy Worker hoặc có domain của Worker (ví dụ: `https://quan-ly-fb-san-cau.<your-subdomain>.workers.dev`), hãy thiết lập Webhook cho Telegram để nhận sự kiện bấm nút `[✅ Duyệt]` và `[🔄 Viết lại]`:

Gõ URL sau vào trình duyệt web (thay thế token và URL thật):
```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://<WORKER_DOMAIN>/api/telegram/webhook&secret_token=telegram_secret_token_123
```

Khi trình duyệt báo `{"ok":true,"result":true,"description":"Webhook was set"}` là đã kích hoạt webhook thành công!

---

## BƯỚC 5: CHẠY THỬ NGHIỆM TẠI MÁY (LOCAL DEVELOPMENT)

1. **Khởi chạy Backend Worker**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   *Worker sẽ chạy tại: `http://localhost:8787`*

2. **Khởi chạy Frontend Dashboard**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   *Dashboard sẽ mở tại: `http://localhost:3000`*

3. Truy cập tab **Cài đặt** trên Web Dashboard và điền:
   - Gemini API Key
   - Telegram Bot Token & Chat ID (bấm nút "Test Bot" để kiểm tra)
   - Facebook Page ID & Access Token (bấm nút "Kiểm tra Fanpage" để kiểm tra)
   - Bấm **Lưu toàn bộ cấu hình**.

---

## BƯỚC 6: TRIỂN KHAI LÊN CLOUDFLARE (PRODUCTION)

1. **Deploy Backend Worker**:
   ```bash
   cd backend
   npm run deploy
   ```

2. **Deploy Frontend lên Cloudflare Pages**:
   ```bash
   cd frontend
   npm run build
   npx wrangler pages deploy dist --project-name=fb-san-cau-admin
   ```

Sau khi hoàn tất, bạn đã có một ứng dụng web serverless chạy 24/7 trên Cloudflare, tự động lên ý tưởng và đăng bài cho Fanpage Sân Cầu với chi phí 0đ!
