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

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('home');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useFeedback();

  const loadSummary = async () => {
    try {
      const data = await api.getSummary();
      setSummary(data);
    } catch (err) {
      console.error('Lỗi tải summary:', err);
    }
  };

  useEffect(() => {
    loadSummary();
    const interval = setInterval(loadSummary, 30000); // Polling 30s
    return () => clearInterval(interval);
  }, []);

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
