import React, { useState, useEffect } from 'react';
import { Idea } from '../types';
import { api } from '../services/api';
import { useFeedback } from '../context/FeedbackContext';
import { Lightbulb, Sparkles, Plus, Trash2, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

interface IdeasPageProps {
  onWritePostFromIdea: (topic: string, description?: string) => Promise<void>;
}

export const IdeasPage: React.FC<IdeasPageProps> = ({ onWritePostFromIdea }) => {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBrainstorming, setIsBrainstorming] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [writingIdeaId, setWritingIdeaId] = useState<string | null>(null);
  const { toast, confirm } = useFeedback();

  const loadIdeas = async () => {
    setLoading(true);
    try {
      const data = await api.getIdeas('pending');
      setIdeas(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIdeas();
  }, []);

  const handleBrainstorm = async () => {
    setIsBrainstorming(true);
    try {
      const freshIdeas = await api.brainstormIdeas('Cầu lông phong trào, giờ vàng, kèo giao lưu, mẹo thể thao', 5);
      setIdeas(freshIdeas);
      toast.success(`AI đã gợi ý thành công ${freshIdeas.length} ý tưởng mới!`);
    } catch (err: any) {
      toast.error('AI Brainstorm thất bại: ' + err.message);
    } finally {
      setIsBrainstorming(false);
    }
  };

  const handleAddManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim()) return;

    try {
      await api.addIdea(newTopic.trim(), newDesc.trim());
      setShowAddModal(false);
      setNewTopic('');
      setNewDesc('');
      toast.success('Đã thêm ý tưởng mới vào kho!');
      loadIdeas();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleWritePost = async (idea: Idea) => {
    setWritingIdeaId(idea.id);
    try {
      await onWritePostFromIdea(idea.topic, idea.description);
      await api.updateIdeaStatus(idea.id, 'used');
      setIdeas(ideas.filter(i => i.id !== idea.id));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setWritingIdeaId(null);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Xác nhận xóa ý tưởng',
      message: 'Bạn có chắc chắn muốn xóa ý tưởng này khỏi kho?',
      confirmText: 'Xóa',
      type: 'danger'
    });

    if (ok) {
      try {
        await api.deleteIdea(id);
        setIdeas(ideas.filter(i => i.id !== id));
        toast.success('Đã xóa ý tưởng thành công!');
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  return (
    <div className="space-y-4 pb-6">
      {/* Top action bar */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
          <Lightbulb className="w-4 h-4 text-purple-600" />
          Kho ý tưởng bài viết ({ideas.length})
        </h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm ý tưởng</span>
          </button>

          <button
            onClick={handleBrainstorm}
            disabled={isBrainstorming}
            className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            {isBrainstorming ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            )}
            <span>AI Nghĩ thêm ý tưởng</span>
          </button>
        </div>
      </div>

      {/* Ideas List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
          <span className="text-xs">Đang tải danh sách ý tưởng...</span>
        </div>
      ) : ideas.length > 0 ? (
        <div className="space-y-2.5">
          {ideas.map((idea) => (
            <div
              key={idea.id}
              className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    idea.generated_by === 'ai' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {idea.generated_by === 'ai' ? '✨ AI Gợi ý' : '👤 Người tạo'}
                  </span>
                  <h3 className="font-semibold text-slate-900 text-xs">{idea.topic}</h3>
                </div>
                {idea.description && (
                  <p className="text-xs text-slate-500 pl-1">{idea.description}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                <button
                  onClick={() => handleDelete(idea.id)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  title="Xóa ý tưởng"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleWritePost(idea)}
                  disabled={writingIdeaId === idea.id}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                >
                  {writingIdeaId === idea.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  <span>Viết bài ngay</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400 space-y-2">
          <p>Chưa có ý tưởng nào trong kho. Bấm nút "AI Nghĩ thêm ý tưởng" để Gemini tự động lập danh sách ý tưởng cho tuần!</p>
        </div>
      )}

      {/* Add Manual Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 shadow-xl space-y-3 animate-in fade-in zoom-in-95">
            <h3 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-purple-600" />
              Thêm ý tưởng mới
            </h3>

            <form onSubmit={handleAddManual} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Chủ đề ý tưởng:</label>
                <input
                  type="text"
                  required
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  placeholder="VD: Rủ rê giao lưu đôi nam nữ tối thứ 5..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gợi ý chi tiết (tùy chọn):</label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Mô tả cụ thể hơn để khi AI viết bài sẽ bám sát ý này..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-xl font-medium"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={!newTopic.trim()}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700"
                >
                  Lưu ý tưởng
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
