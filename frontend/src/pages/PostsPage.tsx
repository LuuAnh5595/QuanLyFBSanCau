import React, { useState, useEffect } from 'react';
import { Post, MediaItem } from '../types';
import { api } from '../services/api';
import { useFeedback } from '../context/FeedbackContext';
import { PostCard } from '../components/PostCard';
import { Filter, Plus, Loader2, Sparkles, X, Check } from 'lucide-react';

interface PostsPageProps {
  onPublishPost: (id: string) => Promise<void>;
  onDeletePost: (id: string) => Promise<void>;
}

export const PostsPage: React.FC<PostsPageProps> = ({ onPublishPost, onDeletePost }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStatus, setCurrentStatus] = useState('all');
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTopic, setCreateTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useFeedback();

  const statusFilters = [
    { id: 'all', label: 'Tất cả' },
    { id: 'pending_approval', label: 'Chờ duyệt' },
    { id: 'published', label: 'Đã đăng' },
    { id: 'draft', label: 'Bản nháp' },
    { id: 'rejected', label: 'Đã hủy' },
    { id: 'failed', label: 'Thất bại' }
  ];

  const loadPosts = async (status: string) => {
    setLoading(true);
    try {
      const data = await api.getPosts(status);
      setPosts(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts(currentStatus);
  }, [currentStatus]);

  const handleEditClick = (post: Post) => {
    setEditingPost(post);
    setEditContent(post.content);
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setIsSavingEdit(true);
    try {
      const updated = await api.updatePost(editingPost.id, { content: editContent });
      setPosts(posts.map(p => p.id === updated.id ? updated : p));
      setEditingPost(null);
      toast.success('Đã lưu nội dung bài viết thành công!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createTopic.trim()) return;
    setIsGenerating(true);
    try {
      const newPost = await api.generatePost({ topic: createTopic.trim() });
      setPosts([newPost, ...posts]);
      setShowCreateModal(false);
      setCreateTopic('');
      toast.success('Đã tạo bài viết AI và gửi vào Telegram để duyệt!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top action and filter bar */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
          <Filter className="w-4 h-4 text-emerald-600" />
          Quản lý bài đăng
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1 shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Tạo bài mới
        </button>
      </div>

      {/* Filter Horizontal Scroll */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {statusFilters.map((f) => (
          <button
            key={f.id}
            onClick={() => setCurrentStatus(f.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              currentStatus === f.id
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Posts List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
          <span className="text-xs">Đang tải danh sách bài viết...</span>
        </div>
      ) : posts.length > 0 ? (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onPublish={async (id) => {
                await onPublishPost(id);
                loadPosts(currentStatus);
              }}
              onEdit={handleEditClick}
              onDelete={async (id) => {
                await onDeletePost(id);
                setPosts(posts.filter(p => p.id !== id));
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
          Không có bài viết nào trong mục này.
        </div>
      )}

      {/* Edit Post Modal */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Chỉnh sửa nội dung bài đăng</h3>
              <button
                onClick={() => setEditingPost(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={8}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
              placeholder="Nhập nội dung bài viết..."
            />

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                onClick={() => setEditingPost(null)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSavingEdit || !editContent.trim()}
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Post Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                Tạo bài viết mới bằng AI
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chủ đề / Ý tưởng bài viết:
                </label>
                <textarea
                  rows={4}
                  value={createTopic}
                  onChange={(e) => setCreateTopic(e.target.value)}
                  placeholder="VD: Thông báo giảm 20% giá sân khung giờ 13h - 16h các ngày trong tuần..."
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !createTopic.trim()}
                  className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Viết bài & Gửi Telegram
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
