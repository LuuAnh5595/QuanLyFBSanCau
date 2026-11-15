import React, { useState, useEffect } from 'react';
import { DashboardSummary, Post } from './types';
import { api } from './services/api';
import { useFeedback } from './context/FeedbackContext';
import { Header } from './components/Header';
import { BottomNav } from './components/BottomNav';
import { HomePage } from './pages/HomePage';
import { PostsPage } from './pages/PostsPage';
import { MediaPage } from './pages/MediaPage';
import { IdeasPage } from './pages/IdeasPage';
import { SettingsPage } from './pages/SettingsPage';
import { AlertTriangle, Link2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('home');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [workerUrlInput, setWorkerUrlInput] = useState(api.getBackendUrl());
  const { toast } = useFeedback();

  const loadSummary = async () => {
    try {
      const data = await api.getSummary();
      setSummary(data);
      setConnectionError(null);
    } catch (err: any) {
      console.error('Lỗi tải summary:', err);
      setConnectionError(err.message || 'Không thể kết nối Backend Worker');
    }
  };

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 30000); // Polling 30s
    return () => clearInterval(interval);
  }, []);

  const handleSaveWorkerUrl = () => {
    if (!workerUrlInput.trim()) {
      toast.error('Vui lòng nhập URL Cloudflare Worker');
      return;
    }
    api.setBackendUrl(workerUrlInput.trim());
    toast.success('Đã lưu URL Backend! Đang thử kết nối lại...');
    loadSummary();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await loadSummary();
      toast.success('Đã làm mới dữ liệu!');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePublishPost = async (id: string) => {
    try {
      await api.publishPost(id);
      await loadSummary();
      toast.success('Đăng bài viết lên Fanpage thành công!');
    } catch (err: any) {
      toast.error('Đăng bài thất bại: ' + err.message);
    }
  };

  const handleDeletePost = async (id: string) => {
    try {
      await api.deletePost(id);
      await loadSummary();
      toast.success('Đã xóa bài viết thành công!');
    } catch (err: any) {
      toast.error('Xóa bài thất bại: ' + err.message);
    }
  };

  const handleGenerateQuickPost = async (topic: string, description?: string) => {
    try {
      await api.generatePost({ topic, description });
      await loadSummary();
      toast.success('Đã tạo bài viết và gửi vào Telegram để duyệt!');
      setCurrentTab('posts');
    } catch (err: any) {
      toast.error('Tạo bài thất bại: ' + err.message);
    }
  };

  const getTabTitle = () => {
    switch (currentTab) {
      case 'posts': return { title: 'Bài viết Fanpage', sub: 'Quản lý duyệt & lịch sử đăng' };
      case 'media': return { title: 'Kho ảnh Sân Cầu', sub: 'Lưu trữ R2 & Google Drive' };
      case 'ideas': return { title: 'Kho ý tưởng AI', sub: 'Chủ đề & kịch bản nội dung' };
      case 'settings': return { title: 'Cài đặt hệ thống', sub: 'Kết nối API & Lịch trình' };
      default: return { title: 'Sân Cầu AI', sub: 'Quản lý Fanpage Tự Động' };
    }
  };

  const tabInfo = getTabTitle();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Top Header */}
      <Header
        title={tabInfo.title}
        subtitle={tabInfo.sub}
        autoPostEnabled={summary?.auto_post_enabled}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area (Max width mobile friendly) */}
      <main className="flex-1 max-w-lg w-full mx-auto p-4 pb-20">
        {/* Connection Error Banner (Nếu chưa kết nối Worker) */}
        {connectionError && (
          <div className="mb-4 bg-amber-50 border border-amber-300 rounded-2xl p-3.5 shadow-sm space-y-2.5 animate-in fade-in">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5 flex-1">
                <h4 className="text-xs font-bold text-amber-900">
                  Chưa kết nối Cloudflare Worker (Backend API)
                </h4>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Trang web đang chạy trên Cloudflare Pages nhưng chưa biết địa chỉ của Backend Worker. Vui lòng dán URL Worker của bạn vào bên dưới:
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
              <input
                type="url"
                value={workerUrlInput}
                onChange={(e) => setWorkerUrlInput(e.target.value)}
                placeholder="https://quan-ly-fb-san-cau.<subdomain>.workers.dev"
                className="flex-1 px-3 py-1.5 bg-white border border-amber-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <button
                type="button"
                onClick={handleSaveWorkerUrl}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0 flex items-center justify-center gap-1"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>Lưu & Kết nối</span>
              </button>
            </div>
          </div>
        )}

        {currentTab === 'home' && (
          <HomePage
            summary={summary}
            onNavigateTab={setCurrentTab}
            onPublishPost={handlePublishPost}
            onEditPost={() => setCurrentTab('posts')}
            onDeletePost={handleDeletePost}
            onGenerateQuickPost={handleGenerateQuickPost}
          />
        )}

        {currentTab === 'posts' && (
          <PostsPage
            onPublishPost={handlePublishPost}
            onDeletePost={handleDeletePost}
          />
        )}

        {currentTab === 'media' && <MediaPage />}

        {currentTab === 'ideas' && (
          <IdeasPage
            onWritePostFromIdea={handleGenerateQuickPost}
          />
        )}

        {currentTab === 'settings' && <SettingsPage />}
      </main>

      {/* Mobile-First Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        pendingCount={summary?.pending_count}
      />
    </div>
  );
};

export default App;
