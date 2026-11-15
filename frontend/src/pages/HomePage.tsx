import React, { useState } from 'react';
import { DashboardSummary, Post } from '../types';
import { PostCard } from '../components/PostCard';
import { Sparkles, Clock, CheckCircle2, Image, Lightbulb, Zap, ArrowRight, Loader2 } from 'lucide-react';

interface HomePageProps {
  summary: DashboardSummary | null;
  onNavigateTab: (tab: string) => void;
  onPublishPost: (id: string) => Promise<void>;
  onEditPost: (post: Post) => void;
  onDeletePost: (id: string) => Promise<void>;
  onGenerateQuickPost: (topic: string) => Promise<void>;
}

export const HomePage: React.FC<HomePageProps> = ({
  summary,
  onNavigateTab,
  onPublishPost,
  onEditPost,
  onDeletePost,
  onGenerateQuickPost
}) => {
  const [quickTopic, setQuickTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleQuickGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTopic.trim()) return;
    setIsGenerating(true);
    try {
      await onGenerateQuickPost(quickTopic.trim());
      setQuickTopic('');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* AI Quick Generator Box */}
      <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800 rounded-2xl p-4 text-white shadow-lg shadow-emerald-900/10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-amber-300" />
          </div>
          <h2 className="font-bold text-sm">Tạo bài viết AI tức thì</h2>
        </div>
        <p className="text-xs text-emerald-100 mb-3">
          Nhập chủ đề hoặc ý tưởng ngắn, Gemini sẽ viết bài đăng Fanpage kèm ảnh và gửi vào Telegram để bạn duyệt.
        </p>

        <form onSubmit={handleQuickGenerate} className="flex gap-2">
          <input
            type="text"
            value={quickTopic}
            onChange={(e) => setQuickTopic(e.target.value)}
            placeholder="VD: Kèo giao lưu tối thứ 7, mẹo chọn vợt..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/15 border border-white/20 text-white placeholder-emerald-200 text-xs focus:outline-none focus:bg-white/25 focus:ring-2 focus:ring-white/40 backdrop-blur-md"
          />
          <button
            type="submit"
            disabled={isGenerating || !quickTopic.trim()}
            className="px-4 py-2.5 bg-white text-emerald-800 font-bold text-xs rounded-xl shadow-md hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1.5 disabled:opacity-60"
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 fill-emerald-600 text-emerald-600" />
                <span>Viết bài</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div 
          onClick={() => onNavigateTab('posts')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-amber-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-400">Chờ duyệt</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{summary?.pending_count || 0}</div>
          <div className="text-[11px] text-amber-600 mt-0.5 font-medium flex items-center gap-1">
            <span>Cần xác nhận</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('posts')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-emerald-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-400">Đã đăng</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{summary?.published_count || 0}</div>
          <div className="text-[11px] text-emerald-600 mt-0.5 font-medium flex items-center gap-1">
            <span>Bài trên Fanpage</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('media')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-blue-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Image className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-400">Kho ảnh</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{summary?.media_count || 0}</div>
          <div className="text-[11px] text-blue-600 mt-0.5 font-medium flex items-center gap-1">
            <span>R2 & Drive</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        <div 
          onClick={() => onNavigateTab('ideas')}
          className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm cursor-pointer hover:border-purple-300 transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Lightbulb className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-slate-400">Kho ý tưởng</span>
          </div>
          <div className="text-2xl font-black text-slate-900">{summary?.ideas_count || 0}</div>
          <div className="text-[11px] text-purple-600 mt-0.5 font-medium flex items-center gap-1">
            <span>Chờ viết bài</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* Pending Posts Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-500" />
            Bài viết chờ duyệt gần đây
          </h3>
          <button
            onClick={() => onNavigateTab('posts')}
            className="text-xs text-emerald-600 font-semibold hover:underline"
          >
            Xem tất cả
          </button>
        </div>

        {summary?.recent_pending_posts && summary.recent_pending_posts.length > 0 ? (
          <div className="space-y-3">
            {summary.recent_pending_posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onPublish={onPublishPost}
                onEdit={onEditPost}
                onDelete={onDeletePost}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">
            Hiện không có bài viết nào đang chờ duyệt. AI sẽ tự động tạo bài vào khung giờ lên lịch tiếp theo!
          </div>
        )}
      </div>

      {/* Recent Activity Logs */}
      {summary?.recent_logs && summary.recent_logs.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2.5">
          <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
            Nhật ký hoạt động hệ thống
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto text-xs">
            {summary.recent_logs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 py-1 border-b border-slate-50 last:border-0">
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  log.level === 'error' ? 'bg-red-500' : log.level === 'warn' ? 'bg-amber-500' : 'bg-emerald-500'
                }`} />
                <div className="flex-1">
                  <div className="font-medium text-slate-800">{log.action}</div>
                  {log.details && <div className="text-[11px] text-slate-400 truncate">{log.details}</div>}
                </div>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {new Date(log.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
