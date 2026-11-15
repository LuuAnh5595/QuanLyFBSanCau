# 🏸 Hệ Thống AI Quản Lý & Tự Động Đăng Bài Facebook Fanpage Sân Cầu

Ứng dụng Serverless chạy trên hệ sinh thái **Cloudflare (Workers, D1, R2, Pages)** giúp tự động sáng tạo nội dung, lên ý tưởng, gửi thông báo duyệt bài tức thì qua **Telegram Bot**, và xuất bản bài viết lên **Facebook Fanpage**.

---

## ✨ Tính Năng Nổi Bật

- ⏰ **Tự động hóa theo lịch trình (Cron Triggers)**: Định kỳ vào các khung giờ vàng (sáng, trưa, tối), hệ thống tự động chọn ý tưởng, yêu cầu Google Gemini viết bài hoàn chỉnh và đính kèm hình ảnh phù hợp.
- 📱 **Xác nhận duyệt bài tức thì qua Telegram Bot**:
  - Gửi bản xem trước kèm ảnh và nội dung bài viết vào Telegram của bạn.
  - 4 Nút bấm tương tác tiện lợi:
    - `[✅ Duyệt & Đăng ngay]`: Gọi Facebook Graph API đăng bài ngay lập tức.
    - `[🔄 Viết lại]`: Yêu cầu Gemini sinh lại bài mới.
    - `[✏️ Sửa trên Web]`: Mở trực tiếp bài viết trên Web để chỉnh sửa.
    - `[❌ Hủy bài]`: Bỏ qua lượt đăng.
- 🌐 **Giao diện Quản trị Web Mobile-First (PWA)**:
  - Thiết kế tối ưu trên điện thoại với thanh **Bottom Navigation** như app native.
  - Xem trước bài đăng chân thực theo chuẩn Facebook Feed.
  - **Kho ảnh (Media Pool)**: Tải ảnh trực tiếp lên Cloudflare R2 hoặc nhập link ảnh chia sẻ từ Google Drive, gắn nhãn phân loại `#san_bai`, `#giao_luu`, `#khuyen_mai`.
  - **Kho ý tưởng (Idea Backlog)**: Quản lý chủ đề bài viết, nút "AI Brainstorm" tự động nghĩ 5-10 ý tưởng mới cho tuần.
  - **Cài đặt & Test kết nối**: Tích hợp các nút bấm kiểm tra tức thì kết nối Telegram, Gemini AI và Fanpage Facebook.
- 🚀 **Chi phí 0đ (100% Serverless Cloudflare)**: Tận dụng hoàn toàn gói Free Tier của Cloudflare Workers, Cloudflare D1 (SQLite), Cloudflare R2 (10GB) và Google Gemini 1.5 Flash Free API.

---

## 🛠️ Cấu Trúc Dự Án

```
├── backend/
│   ├── src/
│   │   ├── cron/
│   │   │   └── scheduled.ts       # Xử lý tự động hóa theo lịch Cron Trigger
│   │   ├── db/
│   │   │   └── repository.ts      # Tầng truy vấn CSDL Cloudflare D1
│   │   ├── routes/
│   │   │   ├── posts.ts           # API quản lý bài đăng, trigger AI, publish FB
│   │   │   ├── media.ts           # API upload ảnh R2, import Google Drive
│   │   │   ├── ideas.ts           # API kho ý tưởng & AI Brainstorm
│   │   │   ├── settings.ts        # API cấu hình hệ thống & test kết nối
│   │   │   └── telegramWebhook.ts # Webhook xử lý nút bấm duyệt trên Telegram
│   │   ├── services/
│   │   │   ├── gemini.ts          # Tích hợp Google Gemini API
│   │   │   ├── telegram.ts        # Tích hợp Telegram Bot & Inline Keyboard
│   │   │   └── facebook.ts        # Tích hợp Facebook Graph API
│   │   ├── types/
│   │   │   ├── env.ts             # Cloudflare Bindings & Secrets Types
│   │   │   └── models.ts          # Data Models (Post, Media, Idea, Config)
│   │   └── index.ts               # Worker entrypoint (Hono HTTP + Cron)
│   ├── schema.sql                 # CSDL SQLite cho Cloudflare D1
│   ├── wrangler.toml              # Cấu hình bindings D1, R2, Cron của Worker
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/            # Header, BottomNav, PostCard Facebook Preview
│   │   ├── pages/                 # Home, Posts, Media, Ideas, Settings
│   │   ├── services/              # API Client kết nối Backend
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── package.json
│
├── DEPLOYMENT_GUIDE.md            # Hướng dẫn chi tiết triển khai lên Cloudflare
└── docs/superpowers/plans/        # Bản đặc tả kỹ thuật và kế hoạch thực thi
```

---

## 🚀 Hướng Dẫn Bắt Đầu Nhanh

Xem chi tiết từng bước tạo Database D1, R2, lấy Token và deploy tại:  
👉 **[Tài liệu Hướng dẫn Triển khai (DEPLOYMENT_GUIDE.md)](DEPLOYMENT_GUIDE.md)**
