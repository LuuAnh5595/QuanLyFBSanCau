import React, { useState, useEffect } from 'react';
import { Post, MediaItem } from '../types';
import { api } from '../services/api';
import { useFeedback } from '../context/FeedbackContext';
import { PostCard } from '../components/PostCard';
import { Filter, Plus, Loader2, Sparkles, X, Check, Image as ImageIcon, Video, Trash2 } from 'lucide-react';

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
  const [editMediaList, setEditMediaList] = useState<MediaItem[]>([]);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [availableMedia, setAvailableMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [mediaPickerTag, setMediaPickerTag] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTopic, setCreateTopic] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useFeedback();

  const isVideoUrl = (url: string, name?: string) => {
    const check = (url + ' ' + (name || '')).toLowerCase();
    return check.includes('.mp4') || check.includes('.mov') || check.includes('.webm') || check.includes('.mkv') || check.includes('/videos/') || check.includes('video');
  };

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
    setEditMediaList(post.media || []);
    setShowMediaPicker(false);
  };

  const openMediaPicker = async () => {
    setShowMediaPicker(true);
    if (availableMedia.length === 0) {
      setLoadingMedia(true);
      try {
        const data = await api.getMedia();
        setAvailableMedia(data);
      } catch (err: any) {
        toast.error('Không thể tải kho ảnh/video: ' + err.message);
      } finally {
        setLoadingMedia(false);
      }
    }
  };

  const toggleSelectMedia = (item: MediaItem) => {
    if (editMediaList.some(m => m.id === item.id)) {
      setEditMediaList(editMediaList.filter(m => m.id !== item.id));
    } else {
      setEditMediaList([...editMediaList, item]);
    }
  };

  const removeMediaFromEdit = (id: string) => {
    setEditMediaList(editMediaList.filter(m => m.id !== id));
  };

  const handleSaveEdit = async () => {
    if (!editingPost) return;
    setIsSavingEdit(true);
    try {
      const mediaIds = editMediaList.map(m => m.id).join(',');
      const updated = await api.updatePost(editingPost.id, { 
        content: editContent,
        media_ids: mediaIds
      });
      setPosts(posts.map(p => p.id === updated.id ? updated : p));
      setEditingPost(null);
      toast.success('Đã lưu nội dung & ảnh/video bài viết thành công!');
    } catch (err: any) {
      toast.error('Lưu bài viết thất bại: ' + err.message);
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
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] flex flex-col p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-sm text-slate-800">Chỉnh sửa bài đăng & Media</h3>
              <button
                onClick={() => setEditingPost(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 pr-1 max-h-[70vh]">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nội dung bài viết:</label>
                <textarea
                  rows={7}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-sans leading-relaxed"
                  placeholder="Nhập nội dung bài viết..."
                />
              </div>

              {/* Attached Media List */}
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    <span>Ảnh & Video đính kèm ({editMediaList.length})</span>
                  </label>
                  <button
                    type="button"
                    onClick={openMediaPicker}
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all shadow-sm"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Chọn từ kho</span>
                  </button>
                </div>

                {editMediaList.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                    {editMediaList.map((m) => {
                      const isVid = isVideoUrl(m.public_url, m.file_name);
                      return (
                        <div key={m.id} className="relative w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-300 shadow-sm group">
                          {isVid ? (
                            <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">
                              <video src={m.public_url} className="w-full h-full object-cover pointer-events-none" preload="metadata" />
                              <span className="absolute bottom-1 left-1 px-1 py-0.2 bg-rose-600 text-white rounded text-[8px] font-bold">
                                🎥 Video
                              </span>
                            </div>
                          ) : (
                            <img src={m.public_url} alt={m.file_name} className="w-full h-full object-cover" />
                          )}
                          <button
                            type="button"
                            onClick={() => removeMediaFromEdit(m.id)}
                            className="absolute top-1 right-1 p-1 bg-black/70 hover:bg-red-600 text-white rounded-full transition-colors shadow"
                            title="Gỡ ảnh/video này"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                    Chưa đính kèm ảnh hoặc video. Bấm <strong>"Chọn từ kho"</strong> để gắn media vào bài viết.
                  </div>
                )}
              </div>
            </div>

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
                className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
              >
                {isSavingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Picker Modal */}
      {showMediaPicker && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Chọn ảnh & video từ kho</h3>
                <p className="text-[11px] text-slate-500">Bấm vào ảnh/video để chọn hoặc bỏ chọn</p>
              </div>
              <button
                onClick={() => setShowMediaPicker(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tag filter */}
            <div className="p-3 border-b bg-slate-50 flex gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: '', label: 'Tất cả' },
                { id: 'video', label: '🎥 Video' },
                { id: 'san_bai', label: '🏟️ Sân bãi' },
                { id: 'giao_luu', label: '🤝 Giao lưu' },
                { id: 'khuyen_mai', label: '🎁 Khuyến mãi' },
                { id: 'ky_thuat', label: '🏸 Kỹ thuật' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setMediaPickerTag(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    mediaPickerTag === t.id ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Media Grid */}
            <div className="p-3 overflow-y-auto flex-1 max-h-[48vh]">
              {loadingMedia ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-400 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-xs">Đang tải kho media...</span>
                </div>
              ) : availableMedia.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {availableMedia
                    .filter(m => {
                      if (!mediaPickerTag) return true;
                      if (mediaPickerTag === 'video') return isVideoUrl(m.public_url, m.file_name);
                      return m.tags?.includes(mediaPickerTag);
                    })
                    .map(m => {
                      const isSelected = editMediaList.some(item => item.id === m.id);
                      const isVid = isVideoUrl(m.public_url, m.file_name);
                      return (
                        <div
                          key={m.id}
                          onClick={() => toggleSelectMedia(m)}
                          className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                            isSelected ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {isVid ? (
                            <div className="w-full h-full bg-slate-900 flex items-center justify-center">
                              <video src={m.public_url} className="w-full h-full object-cover pointer-events-none" preload="metadata" />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                                <span className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[9px] font-bold">🎥 Video</span>
                              </div>
                            </div>
                          ) : (
                            <img src={m.public_url} alt={m.file_name} className="w-full h-full object-cover" />
                          )}

                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-md">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Kho media đang trống. Vui lòng nạp thêm ảnh hoặc video vào kho trước.
                </div>
              )}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t bg-slate-50 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">
                Đã chọn: <strong className="text-emerald-600">{editMediaList.length}</strong> ảnh/video
              </span>
              <button
                type="button"
                onClick={() => setShowMediaPicker(false)}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Xong
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
