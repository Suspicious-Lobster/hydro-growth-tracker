import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

let nextToastId = 1;

const TONE = {
  // Light-theme text is the 800 shade (MR-74): the toast is translucent and
  // blurred, so its effective background is whatever page content sits
  // behind it; green-700 measured 4.22:1 on the blend behind Add Log and
  // axe's floor is 4.5. The 800s read 7.1 / 8.3 / 8.7 on plain white.
  success: { icon: CheckCircle, classes: 'border-green-500/40 bg-green-500/10 text-green-800 dark:text-green-300' },
  error: { icon: AlertTriangle, classes: 'border-red-500/40 bg-red-500/10 text-red-800 dark:text-red-300' },
  info: { icon: Info, classes: 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300' },
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message, type = 'info', timeout = 4000) => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (timeout) setTimeout(() => dismiss(id), timeout);
    return id;
  }, [dismiss]);

  const api = {
    show,
    success: useCallback((m, t) => show(m, 'success', t), [show]),
    error: useCallback((m, t) => show(m, 'error', t ?? 6000), [show]),
    info: useCallback((m, t) => show(m, 'info', t), [show]),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
        {toasts.map((toast) => {
          const tone = TONE[toast.type] || TONE.info;
          const Icon = tone.icon;
          return (
            <div
              key={toast.id}
              role="status"
              className={`flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur ${tone.classes}`}
            >
              <Icon size={18} className="mt-0.5 flex-shrink-0" />
              <div className="flex-1 text-sm">{toast.message}</div>
              <button
                onClick={() => dismiss(toast.id)}
                className="opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Dismiss notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};
