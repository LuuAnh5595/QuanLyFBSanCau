import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useFeedback } from '../context/FeedbackContext';
import { Settings, Save, Send, Facebook, Sparkles, CheckCircle2, AlertCircle, Loader2, Clock, Calendar, Plus, X, Play, RotateCcw, Code, HelpCircle, Link2, Globe, Check } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = `Bạn là biên tập viên sáng tạo nội dung chuyên nghiệp cho Fanpage Sân Cầu Lông Tuổi Trẻ.
Nhiệm vụ: Viết bài đăng Facebook hoàn chỉnh, hấp dẫn, thu hút tương tác cho sân cầu lông.

THÔNG TIN BẮT BUỘC CỦA SÂN CẦU (Phải luôn lồng ghép tự nhiên vào bài viết và phần kêu gọi đặt sân/kết bài):
- Tên sân: Sân cầu Tuổi Trẻ
- Số điện thoại/Zalo: 0337855189
- Địa chỉ: gần trường tiểu học vũ công tể

QUY TẮC BẮT BUỘC (CRITICAL RULES):
1. BẮT BUỘC SỬ DỤNG TIẾNG VIỆT 100%. TUYỆT ĐỐI KHÔNG DÙNG TIẾNG ANH trong toàn bộ bài viết và tiêu đề.
2. TUYỆT ĐỐI KHÔNG xuất ra bất kỳ bước suy nghĩ, phân tích, dàn ý, nháp nào (như * Role, * Goal, * Option, * Drafting, * Refining, Internal Monologue, Outline).
3. BẮT BUỘC LỒNG GHÉP ĐẦY ĐỦ các thông tin cố định của sân: "Sân cầu Tuổi Trẻ", "SĐT: 0337855189", "Địa chỉ: gần trường tiểu học vũ công tể" một cách tự nhiên, rõ ràng ở thân bài hoặc phần CTA đặt sân/kết bài.
4. Bắt đầu bài viết ngay từ dòng đầu tiên bằng Tiêu đề có icon emoji thể thao (🏸, 🔥, 💥, ⚡).
5. Thân bài chia đoạn ngắn gọn, thoáng mắt, dễ đọc trên điện thoại.
6. Cuối bài có Lời kêu gọi hành động (CTA: rủ bạn bè, liên hệ hotline 0337855189, inbox đặt sân) và khối Hashtag (#caulong #badminton #sancautuoitre #giaoluucaulong).
7. Không bọc bài viết trong dấu ngoặc kép hoặc markdown codeblock.`;

const DEFAULT_USER_PROMPT_TEMPLATE = `Chủ đề bài đăng: "{topic}"
{court_section}
{description_section}
Tone giọng: {tone}
Quy tắc: {rules}

(Hãy xuất thẳng nội dung bài viết hoàn chỉnh bằng 100% tiếng Việt, bắt buộc lồng ghép đủ: Sân cầu Tuổi Trẻ, SĐT: 0337855189, Địa chỉ: gần trường tiểu học vũ công tể, không kèm lời dẫn hay dàn ý):`;

export const SettingsPage: React.FC = () => {
  const [configs, setConfigs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [testingTg, setTestingTg] = useState(false);
  const [testingFb, setTestingFb] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
  const [testingCron, setTestingCron] = useState(false);
  const [newSlotTime, setNewSlotTime] = useState('08:30');
  const [backendUrl, setBackendUrl] = useState(api.getBackendUrl());
  const { toast } = useFeedback();

  const [testResult, setTestResult] = useState<{ type: string; message: string; isError?: boolean } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setConfigs(data);
    } catch (err: any) {
      toast.error('Không thể tải cài đặt: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: string, val: string) => {
    setConfigs({ ...configs, [key]: val });
    setSaveSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setTestResult(null);

    try {
      await api.saveSettings(configs);
      setSaveSuccess(true);
      toast.success('Đã lưu cấu hình hệ thống thành công!');
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      toast.error('Lưu cài đặt thất bại: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveBackendUrl = () => {
    api.setBackendUrl(backendUrl);
    toast.success('Đã cập nhật URL Backend Worker! Đang tải lại...');
    loadSettings();
  };

  const handleTestTelegram = async () => {
    setTestingTg(true);
    setTestResult(null);
    try {
      const msg = await api.testTelegram({
        token: configs['telegram_bot_token'],
        chatId: configs['telegram_chat_id']
      });
      setTestResult({ type: 'Telegram', message: msg });
    } catch (err: any) {
      setTestResult({ type: 'Telegram', message: err.message, isError: true });
    } finally {
      setTestingTg(false);
    }
  };

  const handleTestFacebook = async () => {
    setTestingFb(true);
    setTestResult(null);
    try {
      const msg = await api.testFacebook();
      setTestResult({ type: 'Facebook', message: msg });
    } catch (err: any) {
      setTestResult({ type: 'Facebook', message: err.message, isError: true });
    } finally {
      setTestingFb(false);
    }
  };

  const handleTestGemini = async () => {
    setTestingGemini(true);
    setTestResult(null);
    try {
      const res = await api.testGemini();
      if (res.model && res.model !== configs['gemini_model']) {
        setConfigs(prev => ({ ...prev, gemini_model: res.model! }));
      }
      setTestResult({ 
        type: 'Gemini AI', 
        message: `${res.message} Đoạn trích: "${(res.preview || '').slice(0, 100)}..."` 
      });
    } catch (err: any) {
      setTestResult({ type: 'Gemini AI', message: err.message, isError: true });
    } finally {
      setTestingGemini(false);
    }
  };

  const handleTestCron = async () => {
    setTestingCron(true);
    setTestResult(null);
    try {
      const msg = await api.triggerCron();
      setTestResult({ type: 'Tiến trình Tự Động (Cron)', message: msg });
    } catch (err: any) {
      setTestResult({ type: 'Tiến trình Tự Động (Cron)', message: err.message, isError: true });
    } finally {
      setTestingCron(false);
    }
  };

  const currentSlots = (configs['auto_post_slots'] || '08:30, 11:30, 17:30, 20:00')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const handleAddSlot = (slotToAdd: string) => {
    if (!slotToAdd) return;
    if (currentSlots.includes(slotToAdd)) return;
    const updated = [...currentSlots, slotToAdd].sort();
    handleChange('auto_post_slots', updated.join(', '));
  };

  const handleRemoveSlot = (slotToRemove: string) => {
    const updated = currentSlots.filter(s => s !== slotToRemove);
    handleChange('auto_post_slots', updated.join(', '));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
        <span className="text-xs">Đang tải cấu hình hệ thống...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-12">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm text-slate-800 flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-slate-600" />
          Cấu hình Hệ thống & Kết nối API
        </h2>
      </div>

      {saveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-2 text-xs text-emerald-800 font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Đã lưu tất cả cấu hình thành công!
        </div>
      )}

      {testResult && (
        <div className={`p-3 rounded-2xl border flex items-start gap-2 text-xs font-medium animate-in fade-in ${
          testResult.isError
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          {testResult.isError ? (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          )}
          <div>
            <strong>[{testResult.type}]</strong> {testResult.message}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Section: Cloudflare Worker API Connection */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-blue-600" />
              <span>Kết nối Backend API (Cloudflare Worker)</span>
            </h3>
            <button
              type="button"
              onClick={handleSaveBackendUrl}
              className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold hover:underline flex items-center gap-1"
            >
              <Link2 className="w-3 h-3" />
              <span>Áp dụng URL</span>
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">URL Cloudflare Worker:</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={backendUrl}
                onChange={(e) => setBackendUrl(e.target.value)}
                placeholder="https://quan-ly-fb-san-cau.<your-subdomain>.workers.dev"
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleSaveBackendUrl}
                className="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shrink-0"
              >
                Lưu
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              Điền URL Worker của bạn sau khi deploy backend (ví dụ: <code className="text-slate-600">https://quan-ly-fb-san-cau.xxx.workers.dev</code>). Để trống nếu chạy proxy cùng domain hoặc chạy local.
            </p>
          </div>
        </div>

        {/* Section: Auto-Post Master Switch & Scheduling */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>Cài đặt Lịch Tự Động Viết Bài (Cron)</span>
            </h3>
            <button
              type="button"
              onClick={handleTestCron}
              disabled={testingCron}
              className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors disabled:opacity-50"
              title="Kích hoạt thử tiến trình tự động viết bài và gửi Telegram ngay lập tức"
            >
              {testingCron ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3 fill-emerald-600" />}
              <span>Chạy thử tự động ngay</span>
            </button>
          </div>

          {/* Master Switch */}
          <div className="flex items-center justify-between py-1 bg-slate-50 p-3 rounded-xl">
            <div>
              <div className="text-xs font-semibold text-slate-800">Chế độ tự động đăng theo lịch</div>
              <div className="text-[11px] text-slate-400">Tự động chọn ý tưởng, viết bài và gửi Telegram vào các giờ đã chọn</div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={configs['auto_post_enabled'] !== '0'}
                onChange={(e) => handleChange('auto_post_enabled', e.target.checked ? '1' : '0')}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Time Slots Chips */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5 flex items-center justify-between">
              <span>Các khung giờ chạy trong ngày (Giờ Việt Nam UTC+7):</span>
              <span className="text-[10px] text-slate-400 font-normal">Đã chọn: {currentSlots.length} khung giờ</span>
            </label>

            {/* Chips List */}
            <div className="flex flex-wrap gap-2 mb-2">
              {currentSlots.map((slot) => (
                <span
                  key={slot}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold shadow-sm"
                >
                  <Clock className="w-3 h-3 text-emerald-600" />
                  <span>{slot}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSlot(slot)}
                    className="hover:text-red-600 p-0.5 rounded-full hover:bg-emerald-100 transition-colors"
                    title="Xóa khung giờ này"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add Custom Time Input */}
            <div className="flex gap-2 items-center mb-2">
              <input
                type="time"
                value={newSlotTime}
                onChange={(e) => setNewSlotTime(e.target.value)}
                className="p-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              />
              <button
                type="button"
                onClick={() => handleAddSlot(newSlotTime)}
                className="px-3 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold hover:bg-slate-700 flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm giờ</span>
              </button>
            </div>

            {/* Quick Golden Hours Presets */}
            <div className="pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700">Lưới giờ vàng linh hoạt (Bấm để bật/tắt):</span>
                <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Chạy mốc :00 & :30</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2.5">
                Cloudflare tự động thức dậy vào các mốc :00 và :30 từ 07:00 đến 22:30 giờ VN để kiểm tra và viết bài theo các giờ bạn đã chọn (đêm nghỉ hoàn toàn).
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { time: '08:00', label: '🌅 08:00 (Sớm)' },
                  { time: '08:30', label: '🏸 08:30 (Sáng)' },
                  { time: '09:00', label: '☕ 09:00 (Sáng)' },
                  { time: '11:30', label: '☀️ 11:30 (Trưa)' },
                  { time: '12:00', label: '🍱 12:00 (Trưa)' },
                  { time: '14:00', label: '⚡ 14:00 (Chiều)' },
                  { time: '14:30', label: '🏸 14:30 (Chiều)' },
                  { time: '17:00', label: '🌇 17:00 (Tan tầm)' },
                  { time: '17:30', label: '🔥 17:30 (Giờ vàng)' },
                  { time: '19:30', label: '🏸 19:30 (Tối)' },
                  { time: '20:00', label: '🌙 20:00 (Tối)' },
                  { time: '20:30', label: '✨ 20:30 (Tối)' },
                  { time: '21:00', label: '🌃 21:00 (Kèo đêm)' },
                ].map((preset) => {
                  const isSelected = currentSlots.includes(preset.time);
                  return (
                    <button
                      key={preset.time}
                      type="button"
                      onClick={() => isSelected ? handleRemoveSlot(preset.time) : handleAddSlot(preset.time)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Days of Week Setting */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ngày chạy trong tuần:</label>
              <select
                value={configs['auto_post_days'] || 'all'}
                onChange={(e) => handleChange('auto_post_days', e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="all">🗓️ Tất cả các ngày (Thứ 2 - Chủ Nhật)</option>
                <option value="weekdays">💼 Chỉ các ngày trong tuần (Thứ 2 - Thứ 6)</option>
                <option value="weekends">🎉 Chỉ cuối tuần (Thứ 7 & Chủ Nhật)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Số bài tối đa mỗi ngày:</label>
              <select
                value={configs['auto_post_max_per_day'] || '3'}
                onChange={(e) => handleChange('auto_post_max_per_day', e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="1">1 bài / ngày</option>
                <option value="2">2 bài / ngày</option>
                <option value="3">3 bài / ngày (Khuyên dùng)</option>
                <option value="4">4 bài / ngày</option>
                <option value="unlimited">Đăng theo mọi khung giờ đã bật</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section: Thông tin Sân Cầu Lông (Chèn vào mọi bài viết AI) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-emerald-600 font-black">🏸</span>
              <span>Thông tin Sân Cầu Lông (AI luôn chèn vào bài viết)</span>
            </h3>
            <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full">Bắt buộc có</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tên sân cầu lông:</label>
              <input
                type="text"
                value={configs['court_name'] !== undefined ? configs['court_name'] : 'Sân cầu Tuổi Trẻ'}
                onChange={(e) => handleChange('court_name', e.target.value)}
                placeholder="Ví dụ: Sân cầu Tuổi Trẻ"
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Số điện thoại / Zalo đặt sân:</label>
              <input
                type="text"
                value={configs['court_phone'] !== undefined ? configs['court_phone'] : '0337855189'}
                onChange={(e) => handleChange('court_phone', e.target.value)}
                placeholder="Ví dụ: 0337855189"
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Địa chỉ sân cầu:</label>
            <input
              type="text"
              value={configs['court_address'] !== undefined ? configs['court_address'] : 'gần trường tiểu học vũ công tể'}
              onChange={(e) => handleChange('court_address', e.target.value)}
              placeholder="Ví dụ: gần trường tiểu học vũ công tể"
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">Các thông tin này sẽ luôn được AI tự động lồng ghép khéo léo vào nội dung bài viết và phần liên hệ đặt sân.</p>
          </div>
        </div>

        {/* Section: Gemini API Key & Model */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Google Gemini AI (Cấu hình Model)</span>
            </h3>
            <button
              type="button"
              onClick={handleTestGemini}
              disabled={testingGemini}
              className="text-[11px] text-amber-600 font-semibold hover:underline flex items-center gap-1"
            >
              {testingGemini && <Loader2 className="w-3 h-3 animate-spin" />}
              Test Gemini
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Gemini API Key:</label>
            <input
              type="password"
              value={configs['gemini_api_key'] || ''}
              onChange={(e) => handleChange('gemini_api_key', e.target.value)}
              placeholder="AIzaSy..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mô hình AI (Google Gemini):</label>
            <select
              value={configs['gemini_model'] || 'gemini-3.1-flash-lite'}
              onChange={(e) => handleChange('gemini_model', e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Khuyên dùng - Cực nhanh & Chuẩn tiếng Việt)</option>
              <option value="gemini-flash-lite-latest">gemini-flash-lite-latest (Bản Lite mới nhất)</option>
              <option value="gemini-3.5-flash">gemini-3.5-flash (Bản chuẩn thông minh)</option>
              <option value="gemini-3.7-flash">gemini-3.7-flash (Mô hình suy luận cao cấp)</option>
              <option value="gemini-3.8-flash">gemini-3.8-flash (Thế hệ mới nhất)</option>
              <option value="gemini-flash-latest">gemini-flash-latest (Bản Flash tự động cập nhật)</option>
              <option value="gemini-2.5-flash-lite">gemini-2.5-flash-lite</option>
              <option value="gemini-2.0-flash">gemini-2.0-flash</option>
              <option value="gemini-1.5-flash">gemini-1.5-flash</option>
            </select>
            <p className="text-[11px] text-slate-400 mt-1">Hệ thống luôn tự động dò tìm model hoạt động tốt nhất từ Google AI Studio nếu model được chọn gặp sự cố.</p>
          </div>
        </div>

        {/* Section: Custom AI Prompts & Instructions */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-indigo-600" />
              <span>Tùy chỉnh Prompt cho AI viết bài</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">Tự do chỉnh sửa</span>
          </div>

          {/* 1. System Prompt */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                <span>1. System Prompt (Vai trò & Quy chuẩn bài viết của AI)</span>
              </label>
              <button
                type="button"
                onClick={() => handleChange('system_prompt', DEFAULT_SYSTEM_PROMPT)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline"
                title="Khôi phục về prompt chuẩn ban đầu"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Định hình "tính cách", giọng văn và các quy tắc bài đăng Facebook mà AI bắt buộc phải tuân theo.
            </p>
            <textarea
              rows={8}
              value={configs['system_prompt'] !== undefined ? configs['system_prompt'] : DEFAULT_SYSTEM_PROMPT}
              onChange={(e) => handleChange('system_prompt', e.target.value)}
              placeholder="Nhập vai trò và chỉ dẫn hệ thống cho AI..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed bg-slate-50/50"
            />
          </div>

          {/* 2. User Prompt Template */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800 flex items-center gap-1">
                <span>2. Mẫu câu lệnh gửi AI (User Prompt Template)</span>
              </label>
              <button
                type="button"
                onClick={() => handleChange('user_prompt_template', DEFAULT_USER_PROMPT_TEMPLATE)}
                className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1 hover:underline"
                title="Khôi phục mẫu câu lệnh chuẩn"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Khôi phục mặc định</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Cấu trúc nội dung truyền cho AI mỗi khi viết bài. Bạn có thể sử dụng các thẻ giữ chỗ:
            </p>
            <div className="flex flex-wrap gap-1.5 py-1">
              {[
                { tag: '{topic}', desc: 'Chủ đề bài viết' },
                { tag: '{description}', desc: 'Mô tả/Sân bãi/SĐT' },
                { tag: '{tone}', desc: 'Tone giọng' },
                { tag: '{rules}', desc: 'Quy tắc & hashtag' }
              ].map(({ tag, desc }) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-md text-[10px] font-mono cursor-pointer hover:bg-indigo-100"
                  title={`Thẻ ${desc}`}
                >
                  {tag} <span className="text-slate-400 font-sans">({desc})</span>
                </span>
              ))}
            </div>
            <textarea
              rows={4}
              value={configs['user_prompt_template'] !== undefined ? configs['user_prompt_template'] : DEFAULT_USER_PROMPT_TEMPLATE}
              onChange={(e) => handleChange('user_prompt_template', e.target.value)}
              placeholder="Nhập cấu trúc prompt gửi AI..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 leading-relaxed bg-slate-50/50"
            />
          </div>

          {/* 3. Tone & Hashtags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tone giọng mặc định:</label>
              <input
                type="text"
                value={configs['default_tone'] || ''}
                onChange={(e) => handleChange('default_tone', e.target.value)}
                placeholder="năng động, vui tươi, hào hứng, tự nhiên..."
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Quy tắc & Hashtag định hướng:</label>
              <input
                type="text"
                value={configs['prompt_rules'] || ''}
                onChange={(e) => handleChange('prompt_rules', e.target.value)}
                placeholder="Ngắt dòng thoáng, chèn icon, hashtag #caulong #badminton..."
                className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Section: Telegram Bot */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-blue-500" />
              <span>Telegram Bot (Thông báo & Duyệt)</span>
            </h3>
            <button
              type="button"
              onClick={handleTestTelegram}
              disabled={testingTg}
              className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-1"
            >
              {testingTg && <Loader2 className="w-3 h-3 animate-spin" />}
              Test Bot
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Telegram Bot Token (từ @BotFather):</label>
            <input
              type="password"
              value={configs['telegram_bot_token'] || ''}
              onChange={(e) => handleChange('telegram_bot_token', e.target.value)}
              placeholder="123456789:ABCdefGhI..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Telegram Chat ID nhận thông báo:</label>
            <input
              type="text"
              value={configs['telegram_chat_id'] || ''}
              onChange={(e) => handleChange('telegram_chat_id', e.target.value)}
              placeholder="VD: 987654321 hoặc -100123456789"
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Section: Google Drive Webhook (Đồng bộ ảnh tự động) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <span className="text-blue-600 font-bold">☁️</span>
              <span>Đồng bộ Google Drive (Google Apps Script Webhook)</span>
            </h3>
            <span className="text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">Tự động 2 chiều</span>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Cho phép khi bạn gửi ảnh qua Telegram Bot, ảnh sẽ <strong>tự động lưu vào Thư mục Google Drive</strong> của bạn, hoặc bấm nút quét toàn bộ thư mục Drive vào Kho AI.
          </p>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Google Apps Script Web App URL:</label>
            <input
              type="url"
              value={configs['gdrive_script_url'] || ''}
              onChange={(e) => handleChange('gdrive_script_url', e.target.value)}
              placeholder="https://script.google.com/macros/s/.../exec"
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>

          {/* Guide Card with 1-click Copy */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="font-semibold text-slate-800 flex items-center gap-1">
              <span>📋 Hướng dẫn tạo Script Google Drive trong 2 phút:</span>
            </div>
            <ol className="list-decimal list-inside text-slate-600 space-y-1 text-[11px] leading-relaxed">
              <li>Mở Google Drive, tạo 1 thư mục (ví dụ: <code className="bg-white px-1 border rounded">Anh_San_Tuoi_Tre</code>) và copy <strong>ID Thư mục</strong> từ thanh địa chỉ trình duyệt.</li>
              <li>Truy cập <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">script.google.com</a>, bấm <strong>Dự án mới (New project)</strong>.</li>
              <li>Dán đoạn mã bên dưới vào, thay <code className="bg-white px-1 border rounded">DIEN_ID_THU_MUC_DRIVE_VAO_DAY</code> bằng ID thư mục của bạn.</li>
              <li>Bấm <strong>Triển khai (Deploy)</strong> &gt; <strong>Tùy chọn triển khai mới (New deployment)</strong> &gt; Chọn loại <strong>Ứng dụng web (Web app)</strong> &gt; Quyền truy cập: <strong>Bất kỳ ai (Anyone)</strong>.</li>
              <li>Copy đường link Web App (dạng <code className="bg-white px-1 border rounded">.../exec</code>) và dán vào ô bên trên rồi bấm Lưu.</li>
            </ol>
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  const code = `const FOLDER_ID = "DIEN_ID_THU_MUC_DRIVE_VAO_DAY";

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    if (data.action === "upload") {
      const decoded = Utilities.base64Decode(data.base64);
      const blob = Utilities.newBlob(decoded, data.mimeType || "image/jpeg", data.fileName || "badminton.jpg");
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      const fileId = file.getId();
      return ContentService.createTextOutput(JSON.stringify({ success: true, fileId: fileId, url: "https://lh3.googleusercontent.com/d/" + fileId })).setMimeType(ContentService.MimeType.JSON);
    }
    if (data.action === "list") {
      const files = folder.getFiles();
      const list = [];
      while (files.hasNext()) {
        const f = files.next();
        list.push({ id: f.getId(), name: f.getName(), url: "https://lh3.googleusercontent.com/d/" + f.getId(), mimeType: f.getMimeType() });
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, files: list })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;
                  navigator.clipboard.writeText(code);
                  toast.success('Đã sao chép mã Google Apps Script mẫu vào bộ nhớ tạm!');
                }}
                className="px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold hover:bg-slate-100 flex items-center gap-1.5 transition-colors"
              >
                <Code className="w-3.5 h-3.5 text-blue-600" />
                <span>Sao chép mã Google Apps Script mẫu</span>
              </button>
            </div>
          </div>
        </div>

        {/* Section: Facebook Page */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Facebook className="w-3.5 h-3.5 text-[#1877F2]" />
              <span>Facebook Fanpage Graph API</span>
            </h3>
            <button
              type="button"
              onClick={handleTestFacebook}
              disabled={testingFb}
              className="text-[11px] text-[#1877F2] font-semibold hover:underline flex items-center gap-1"
            >
              {testingFb && <Loader2 className="w-3 h-3 animate-spin" />}
              Kiểm tra Fanpage
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Facebook Page ID:</label>
            <input
              type="text"
              value={configs['fb_page_id'] || ''}
              onChange={(e) => handleChange('fb_page_id', e.target.value)}
              placeholder="VD: 104592837482910"
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Page Access Token (Long-lived):</label>
            <input
              type="password"
              value={configs['fb_page_access_token'] || ''}
              onChange={(e) => handleChange('fb_page_access_token', e.target.value)}
              placeholder="EAAB..."
              className="w-full p-2.5 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1877F2]"
            />
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Lưu toàn bộ cấu hình
          </button>
        </div>
      </form>
    </div>
  );
};
