import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    const isIt = (() => {
      try { return (navigator.language ?? '').toLowerCase().startsWith('it'); } catch { return false; }
    })();
    const L = isIt
      ? { title: 'Qualcosa è andato storto', body: "L'app ha incontrato un errore inatteso. Puoi provare a ripristinare la vista oppure ricaricare l'app.", details: 'Dettagli tecnici', retry: 'Riprova', reload: 'Ricarica' }
      : { title: 'Something went wrong', body: 'The app hit an unexpected error. You can try to restore the view or reload the app.', details: 'Technical details', retry: 'Retry', reload: 'Reload' };

    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text p-6">
        <div className="max-w-md w-full bg-card border border-border rounded-2xl p-6 shadow-DEFAULT">
          <div className="flex items-center gap-3 mb-3">
            <span className="w-2.5 h-2.5 rounded-full bg-red" />
            <h2 className="text-lg font-semibold">{L.title}</h2>
          </div>
          <p className="text-sm text-text-sec mb-4">{L.body}</p>
          <details className="mb-4 text-xs text-text-sec">
            <summary className="cursor-pointer select-none">{L.details}</summary>
            <pre className="mt-2 p-2 rounded-lg bg-bg border border-border overflow-auto max-h-40 whitespace-pre-wrap break-words">
              {error.name}: {error.message}
              {error.stack ? `\n\n${error.stack}` : ''}
            </pre>
          </details>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="flex-1 px-4 py-2 rounded-xl bg-accent text-white font-medium text-sm hover:opacity-90 transition-opacity"
            >
              {L.retry}
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-4 py-2 rounded-xl bg-card border border-border text-text font-medium text-sm hover:bg-bg transition-colors"
            >
              {L.reload}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
