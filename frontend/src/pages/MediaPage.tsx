import React, { useState, useEffect, useRef } from 'react';
import { MediaItem } from '../types';
import { api } from '../services/api';
import { useFeedback } from '../context/FeedbackContext';
import { Image, Upload, Link as LinkIcon, Trash2, Tag, Loader2, Plus, ExternalLink } from 'lucide-react';

export const MediaPage: React.FC = () => {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showImportUrlModal, setShowImportUrlModal] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importTag, setImportTag] = useState('san_bai');
  const [importName, setImportName] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, confirm } = useFeedback();

  const tagOptions = [
    { id: '', label: 'Tất cả' },
    { id: 'san_bai', label: '🏟️ Sân bãi' },
    { id: 'giao_luu', label: '🤝 Giao lưu' },
    { id: 'khuyen_mai', label: '🎁 Khuyến mãi' },
    { id: 'ky_thuat', label: '🏸 Kỹ thuật' },
    { id: 'giai_dau', label: '🏆 Giải đấu' },
  ];

  const loadMedia = async (tag?: string) => {
    setLoading(true);
    try {
      const data = await api.getMedia(tag || undefined);
      setMediaList(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia(selectedTag);
  }, [selectedTag]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const file = files[0];
      const newItem = await api.uploadMedia(file, selectedTag || 'san_bai');
      setMediaList([newItem, ...mediaList]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Đã tải ảnh lên kho thành công!');
    } catch (err: any) {
      toast.error('Tải ảnh thất bại: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImportUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim()) return;

    setIsImporting(true);
    try {
      const item = await api.importMediaUrl(importUrl.trim(), importTag, importName || 'Ảnh tải từ Drive');
      setMediaList([item, ...mediaList]);
      setShowImportUrlModal(false);
      setImportUrl('');
      setImportName('');
      toast.success('Đã thêm liên kết ảnh thành công!');
    } catch (err: any) {
      toast.error('Import ảnh thất bại: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Xóa ảnh khỏi kho',
      message: 'Bạn có chắc chắn muốn xóa ảnh này khỏi kho lưu trữ?',
      confirmText: 'Xóa ảnh',
      type: 'danger'
    });

    if (ok) {
      try {
        await api.deleteMedia(id);
        setMediaList(mediaList.filter(m => m.id !== id));
        toast.success('Đã xóa ảnh thành công!');
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
          <Image className="w-4 h-4 text-blue-600" />
          Kho ảnh bài viết ({mediaList.length})
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportUrlModal(true)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1"
          >
            <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Thêm từ Drive</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm disabled:opacity-50"
          >
            {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            <span>Tải ảnh lên R2</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Tag Filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {tagOptions.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedTag(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
              selectedTag === t.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs">Đang tải kho ảnh...</span>
        </div>
      ) : mediaList.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {mediaList.map((media) => (
            <div
              key={media.id}
              className="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
            >
              <div className="relative aspect-square bg-slate-100 overflow-hidden">
                <img
                  src={media.public_url}
                  alt={media.file_name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <button
                  onClick={() => handleDelete(media.id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Xóa ảnh"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm text-[10px] text-white rounded-md font-medium">
                  {media.source_type === 'gdrive' ? 'Google Drive' : 'R2'}
                </div>
              </div>

              <div className="p-2 text-[11px] flex items-center justify-between gap-1 border-t border-slate-100">
                <div className="truncate font-medium text-slate-700 flex-1" title={media.file_name}>
                  {media.file_name}
                </div>
                <div className="text-[10px] text-slate-400 shrink-0">
                  Dùng {media.usage_count} lần
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400 space-y-2">
          <p>Kho ảnh trống. Hãy tải ảnh sân bãi hoặc nhập link Google Drive để AI sử dụng khi đăng bài!</p>
        </div>
      )}

      {/* Import from URL / Google Drive Modal */}
      {showImportUrlModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <LinkIcon className="w-4 h-4 text-blue-600" />
              Thêm ảnh từ Google Drive hoặc URL
            </h3>
            <p className="text-xs text-slate-500">
              Dán liên kết ảnh từ Google Drive (chế độ chia sẻ bất kỳ ai có link đều xem được) hoặc link ảnh trực tiếp.
            </p>

            <form onSubmit={handleImportUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Đường dẫn ảnh:</label>
                <input
                  type="url"
                  required
                  value={importUrl}
                  onChange={(e) => setImportUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tên mô tả ảnh (tùy chọn):</label>
                <input
                  type="text"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="VD: Sân số 1 buổi tối đèn sáng"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gắn nhãn (Tag phân loại):</label>
                <select
                  value={importTag}
                  onChange={(e) => setImportTag(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="san_bai">🏟️ Sân bãi</option>
                  <option value="giao_luu">🤝 Giao lưu</option>
                  <option value="khuyen_mai">🎁 Khuyến mãi</option>
                  <option value="ky_thuat">🏸 Kỹ thuật</option>
                  <option value="giai_dau">🏆 Giải đấu</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowImportUrlModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !importUrl.trim()}
                  className="px-4 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isImporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Lưu vào kho ảnh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
