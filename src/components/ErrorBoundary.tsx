import { Component, type ReactNode } from 'react';

interface State { error: Error | null }

/**
 * Jaring pengaman: kalau ada error saat render, tampilkan pesan dan tombol muat ulang,
 * bukan layar kosong. Data di browser tidak disentuh. Teks dua bahasa karena komponen ini
 * berada di luar LanguageProvider.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-slate-800" data-testid="error-boundary">
        <h1 className="text-lg font-bold">Terjadi kesalahan / Something went wrong</h1>
        <p className="text-sm text-slate-600">
          Datamu aman di browser ini. Coba muat ulang halaman. / Your data is safe in this browser. Try reloading.
        </p>
        <pre className="overflow-x-auto rounded-xl bg-slate-100 p-3 text-xs text-slate-700">{error.message}</pre>
        <button onClick={() => window.location.reload()} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
          Muat ulang / Reload
        </button>
      </div>
    );
  }
}
