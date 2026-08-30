import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

/**
 * App-wide toast notifications.
 *
 * The design system already shipped `.toast`, `.toast-success`, `.toast-error`
 * and `.toast-info` (plus the toast-in/out keyframes) but nothing rendered
 * them — user feedback went through blocking `window.alert()` dialogs instead.
 * This provider wires those styles up so success/error feedback is
 * non-blocking and consistent across the app.
 */

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const VISIBLE_MS = 4000;
// Must match the `toast-out` animation duration in tailwind.config.js so the
// node is removed exactly when it finishes animating out.
const EXIT_MS = 400;

const ICONS: Record<ToastType, React.ReactElement> = {
  success: (
    <svg className="w-5 h-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-primary-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  // Tracked so unmounting mid-flight never leaves a stray timer running.
  const timers = useRef<number[]>([]);

  const remove = useCallback((id: number) => {
    // Play the exit animation first, then drop the node.
    setToasts(prev => prev.map(t => (t.id === id ? { ...t, leaving: true } : t)));
    timers.current.push(
      window.setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), EXIT_MS)
    );
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = nextId.current++;
      setToasts(prev => [...prev, { id, type, message, leaving: false }]);
      timers.current.push(window.setTimeout(() => remove(id), VISIBLE_MS));
    },
    [remove]
  );

  React.useEffect(
    () => () => {
      timers.current.forEach(window.clearTimeout);
    },
    []
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (m: string) => showToast(m, 'success'),
      error: (m: string) => showToast(m, 'error'),
      info: (m: string) => showToast(m, 'info'),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`toast-${t.type} ${t.leaving ? 'animate-toast-out' : ''}`}
          >
            {ICONS[t.type]}
            <p className="flex-1 text-sm font-medium text-surface-800 break-words">{t.message}</p>
            <button
              onClick={() => remove(t.id)}
              aria-label="Dismiss notification"
              className="text-surface-300 hover:text-surface-600 transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};

export default ToastContext;
