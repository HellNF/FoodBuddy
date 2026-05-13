import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastOptions {
  type?: ToastType;
  duration?: number; // ms; 0 = sticky
  action?: ToastAction;
}

interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
  action?: ToastAction;
}

type ShowFn = {
  (text: string, type?: ToastType): void;
  (text: string, opts: ToastOptions): void;
};

interface ToastContextValue {
  show: ShowFn;
}

const noop: ShowFn = () => {};
const ToastContext = createContext<ToastContextValue>({ show: noop });

let nextId = 0;
const DEFAULT_DURATION = 2500;

const INDICATOR: Record<ToastType, string> = {
  success: 'bg-green',
  error:   'bg-red',
  info:    'bg-accent',
  warning: 'bg-yellow',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(t => t.filter(m => m.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(((text: string, arg?: ToastType | ToastOptions) => {
    const opts: ToastOptions = typeof arg === 'string' || arg === undefined
      ? { type: arg as ToastType | undefined }
      : arg;
    const type: ToastType = opts.type ?? 'success';
    const duration = opts.duration ?? DEFAULT_DURATION;

    const id = ++nextId;
    setToasts(t => [...t, { id, text, type, action: opts.action }]);

    if (duration > 0) {
      const timer = setTimeout(() => dismiss(id), duration);
      timersRef.current.set(id, timer);
    }
  }) as ShowFn, [dismiss]);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {createPortal(
        <div
          role="region"
          aria-live="polite"
          aria-label="Notifiche"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-[100] pointer-events-none"
        >
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

// Interruptible enter via [data-mounted] flip — better than keyframes when
// toasts are added rapidly, since transitions retarget smoothly.
function ToastItem({ toast, dismiss }: { toast: ToastMessage; dismiss: (id: number) => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
            <div
              data-mounted={mounted ? 'true' : 'false'}
              role={toast.type === 'error' ? 'alert' : 'status'}
              style={{
                transition:
                  'opacity 220ms var(--ease-out-strong), transform 220ms var(--ease-out-strong)',
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.96)',
              }}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-card border border-border shadow-DEFAULT text-sm font-medium text-text min-w-[180px] pointer-events-auto"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${INDICATOR[toast.type]}`} aria-hidden />
              <span className="flex-1">{toast.text}</span>
              {toast.action && (
                <button
                  type="button"
                  onClick={() => {
                    toast.action!.onClick();
                    dismiss(toast.id);
                  }}
                  className="text-accent font-semibold text-xs uppercase tracking-wide hover:opacity-80 transition-opacity ml-1"
                >
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                aria-label="Chiudi notifica"
                onClick={() => dismiss(toast.id)}
                className="text-text-sec hover:text-text text-base leading-none ml-1 transition-colors"
              >
                ×
              </button>
            </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  return { show: ctx.show, showToast: ctx.show };
}
