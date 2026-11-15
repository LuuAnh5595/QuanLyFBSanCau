import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

export interface ConfirmDialogOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'primary' | 'warning';
}

interface FeedbackContextType {
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
    info: (msg: string) => void;
    warning: (msg: string) => void;
  };
  confirm: (options: ConfirmDialogOptions | string) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextType | null>(null);

export const useFeedback = () => {
  const ctx = useContext(FeedbackContext);
  if (!ctx) {
    throw new Error('useFeedback must be used within FeedbackProvider');
  }
  return ctx;
};

export const FeedbackProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // State cho Confirm Modal
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmDialogOptions;
    resolve: (val: boolean) => void;
  } | null>(null);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (type: ToastMessage['type'], message: string) => {
      const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);
      setToasts((prev) => [...prev, { id, type, message }]);

      // Tự động đóng sau 3.5 giây
      setTimeout(() => {
        removeToast(id);
      }, 3500);
    },
    [removeToast]
  );

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    info: (msg: string) => addToast('info', msg),
    warning: (msg: string) => addToast('warning', msg),
  };

  const confirm = useCallback((options: ConfirmDialogOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opt: ConfirmDialogOptions =
        typeof options === 'string'
          ? {
              title: 'Xác nhận thao tác',
              message: options,
              confirmText: 'Đồng ý',
              cancelText: 'Hủy bỏ',
              type: 'primary',
            }
          : {
              title: options.title || 'Xác nhận',
              message: options.message,
              confirmText: options.confirmText || 'Đồng ý',
              cancelText: options.cancelText || 'Hủy bỏ',
              type: options.type || 'primary',
            };

      setConfirmState({
        isOpen: true,
        options: opt,
        resolve,
      });
    });
  }, []);

  const handleConfirmAction = (accepted: boolean) => {
    if (confirmState) {
      confirmState.resolve(accepted);
      setConfirmState(null);
    }
  };

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Notifications Container */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((t) => {
          let bgClass = 'bg-slate-900 text-white border-slate-700';
          let Icon = Info;

          if (t.type === 'success') {
            bgClass = 'bg-emerald-600 text-white border-emerald-500';
            Icon = CheckCircle2;
          } else if (t.type === 'error') {
            bgClass = 'bg-rose-600 text-white border-rose-500';
            Icon = AlertCircle;
          } else if (t.type === 'warning') {
            bgClass = 'bg-amber-500 text-white border-amber-400';
            Icon = AlertTriangle;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto shadow-xl rounded-2xl p-3.5 border flex items-center justify-between gap-3 text-xs font-semibold backdrop-blur-md transition-all animate-in slide-in-from-top-2 fade-in duration-200 ${bgClass}`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate leading-tight">{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="p-1 hover:bg-white/20 rounded-lg shrink-0 transition-colors"
                title="Đóng"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 flex flex-col gap-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-100 text-rose-600'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-emerald-100 text-emerald-600'
                }`}
              >
                {confirmState.options.type === 'danger' ? (
                  <AlertCircle className="w-5 h-5" />
                ) : confirmState.options.type === 'warning' ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
              </div>

              <div className="space-y-1 flex-1">
                <h3 className="font-bold text-sm text-slate-900">
                  {confirmState.options.title}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleConfirmAction(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition-colors"
              >
                {confirmState.options.cancelText}
              </button>

              <button
                type="button"
                onClick={() => handleConfirmAction(true)}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-sm ${
                  confirmState.options.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                    : confirmState.options.type === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'
                }`}
              >
                {confirmState.options.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};
