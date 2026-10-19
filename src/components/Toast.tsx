import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { useT } from '@/i18n';

export type ToastKind = 'success' | 'error';
export interface ToastState {
  kind: ToastKind;
  message: string;
  /** Tombol aksi di toast, misalnya Urungkan. Toast bertahan lebih lama supaya sempat ditekan. */
  action?: { label: string; run: () => void };
}

interface ToastProps {
  toast: ToastState | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const { t: tx } = useT();
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, toast.action ? 7000 : 3500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const success = toast.kind === 'success';

  return (
    <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 px-4 w-full max-w-sm animate-[toastIn_0.25s_ease-out]">
      <div
        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-md transition-all ${
          success
            ? 'border-emerald-200/80 bg-emerald-50/95 text-emerald-900'
            : 'border-red-200 bg-red-50 text-red-900'
        }`}
      >
        <div className={`p-1 rounded-xl ${success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
          {success ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
        </div>
        <p className="flex-1 text-xs font-semibold leading-snug">{toast.message}</p>
        {toast.action && (
          <button
            data-testid="toast-action"
            onClick={() => { const run = toast.action!.run; onDismiss(); run(); }}
            className="min-h-9 shrink-0 rounded-lg px-3 text-xs font-bold text-brand-700 underline-offset-2 hover:bg-black/5 hover:underline"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={onDismiss}
          className={`rounded-lg p-1 transition-colors hover:bg-black/5 ${
            success ? 'text-emerald-700' : 'text-red-700'
          }`}
          aria-label={tx('shell.toast.dismiss')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}