import React, { useState } from 'react';
import { Post } from '../types';
import { formatVNDateTime } from '../utils/date';
import { useFeedback } from '../context/FeedbackContext';
import { CheckCircle2, XCircle, Edit3, Send, ExternalLink, Trash2, Clock, AlertTriangle, Facebook } from 'lucide-react';

interface PostCardProps {
  post: Post;
  fanpageName?: string;
  onPublish: (id: string) => Promise<void>;
  onEdit: (post: Post) => void;
  onDelete: (id: string) => Promise<void>;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  fanpageName = 'Fanpage Sân Cầu Lông',
  onPublish,
  onEdit,
  onDelete
}) => {
  const [isPublishing, setIsPublishing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const { confirm } = useFeedback();

  const handlePublish = async () => {
    const ok = await confirm({
      title: 'Đăng bài lên Facebook',
      message: 'Bạn có chắc chắn muốn đăng bài viết này lên Fanpage ngay bây giờ?',
      confirmText: 'Đăng ngay',
      type: 'primary'
    });

    if (ok) {
      setIsPublishing(true);
      try {
        await onPublish(post.id);
      } finally {
        setIsPublishing(false);
      }
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Xác nhận xóa bài viết',
      message: 'Bài viết này sẽ bị xóa vĩnh viễn khỏi hệ thống. Bạn có chắc chắn muốn xóa?',
      confirmText: 'Xóa bài',
      type: 'danger'
    });

    if (ok) {
      setIsDeleting(true);
      try {
        await onDelete(post.id);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const getStatusBadge = () => {
    switch (post.status) {
      case 'published':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" /> Đã đăng
          </span>
        );
      case 'pending_approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 animate-pulse">
            <Clock className="w-3.5 h-3.5" /> Chờ duyệt
          </span>
        );
      case 'publishing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <Send className="w-3.5 h-3.5 animate-bounce" /> Đang đăng...
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
            <XCircle className="w-3.5 h-3.5" /> Đã hủy
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            <AlertTriangle className="w-3.5 h-3.5" /> Thất bại
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
            Bản nháp
          </span>
        );
    }
  };

  const mediaList = post.media || [];
  const previewText = showFull ? post.content : post.content.slice(0, 240);
  const isTruncated = post.content.length > 240;

  const isVideoUrl = (url: string, name?: string) => {
    const check = (url + ' ' + (name || '')).toLowerCase();
    return check.includes('.mp4') || check.includes('.mov') || check.includes('.webm') || check.includes('.mkv') || check.includes('/videos/') || check.includes('video');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
      {/* Facebook Header Preview */}
      <div className="p-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600 flex items-center justify-center text-white text-lg font-bold shadow-sm">
            🏸
          </div>
          <div>
            <div className="font-semibold text-slate-900 text-sm flex items-center gap-1">
              {fanpageName}
              <Facebook className="w-3.5 h-3.5 text-[#1877F2]" fill="#1877F2" />
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1">
              <span>{formatVNDateTime(post.created_at)}</span>
              <span>•</span>
              <span>🌍 Công khai</span>
            </div>
          </div>
        </div>
        <div>{getStatusBadge()}</div>
      </div>

      {/* Post Content */}
      <div className="p-4 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
        {previewText}
        {isTruncated && !showFull && (
          <button
            onClick={() => setShowFull(true)}
            className="text-emerald-600 font-semibold ml-1 hover:underline text-xs"
          >
            ...Xem thêm
          </button>
        )}
        {showFull && isTruncated && (
          <button
            onClick={() => setShowFull(false)}
            className="text-slate-400 font-medium ml-1 hover:underline text-xs"
          >
            Thu gọn
          </button>
        )}
      </div>

      {/* Post Media (Images & Videos) */}
      {mediaList.length > 0 && (
        <div className="bg-slate-950 border-t border-b border-slate-100 overflow-hidden">
          {mediaList.length === 1 ? (
            isVideoUrl(mediaList[0].public_url, mediaList[0].file_name) ? (
              <video
                src={mediaList[0].public_url}
                controls
                preload="metadata"
                className="w-full max-h-80 bg-black object-contain"
              />
            ) : (
              <img
                src={mediaList[0].public_url}
                alt={mediaList[0].file_name}
                className="w-full max-h-80 object-cover"
                loading="lazy"
              />
            )
          ) : (
            <div className="grid grid-cols-2 gap-1 bg-slate-100">
              {mediaList.slice(0, 4).map((m, idx) => (
                isVideoUrl(m.public_url, m.file_name) ? (
                  <div key={idx} className="relative w-full h-40 bg-black flex items-center justify-center">
                    <video
                      src={m.public_url}
                      className="w-full h-40 object-cover"
                      preload="metadata"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                      <span className="px-2 py-1 bg-black/70 text-white rounded-lg text-[10px] font-bold">
                        ▶ Video
                      </span>
                    </div>
                  </div>
                ) : (
                  <img
                    key={idx}
                    src={m.public_url}
                    alt={m.file_name}
                    className="w-full h-40 object-cover"
                    loading="lazy"
                  />
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error Message if any */}
      {post.error_message && (
        <div className="mx-4 mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
          <strong>Lỗi:</strong> {post.error_message}
        </div>
      )}

      {/* Post Action Buttons */}
      <div className="p-3 bg-slate-50 flex items-center justify-between border-t border-slate-100 gap-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(post)}
            className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-slate-200/60 rounded-xl transition-colors text-xs flex items-center gap-1 font-medium"
            title="Chỉnh sửa bài viết"
          >
            <Edit3 className="w-4 h-4" />
            <span className="hidden sm:inline">Sửa</span>
          </button>

          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors text-xs"
            title="Xóa bài viết"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {post.status === 'published' && post.fb_post_url && (
            <a
              href={post.fb_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-semibold hover:bg-blue-100 transition-colors flex items-center gap-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Xem trên FB
            </a>
          )}

          {post.status !== 'published' && (
            <button
              onClick={handlePublish}
              disabled={isPublishing}
              className="px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-600 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isPublishing ? 'animate-bounce' : ''}`} />
              {isPublishing ? 'Đang đăng...' : 'Duyệt & Đăng ngay'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
