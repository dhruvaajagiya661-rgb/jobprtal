import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Catches render-time errors in any descendant component and shows a friendly
 * fallback instead of unmounting the whole React tree (blank screen).
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? error.message : 'Something went wrong';
    // Detect the classic "API returned HTML instead of JSON" pattern that
    // occurs when the backend is unreachable (e.g. Vercel frontend without
    // a deployed backend).
    const isApiOffline =
      msg.includes('map is not a function') ||
      msg.includes('API returned HTML instead of JSON');
    return {
      hasError: true,
      message: isApiOffline
        ? 'The backend server appears to be offline or unreachable. Please ensure the API server is running and accessible.'
        : msg,
    };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Keep the console noise (React logs it anyway) but never break the app.
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    // Reset state first so a re-render attempt is made after navigation.
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-20 h-20 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-surface-900 mb-2">Something went wrong</h2>
          <p className="text-surface-500 mb-2">
            An unexpected error occurred while rendering this page.
          </p>
          {this.state.message && (
            <p className="text-xs text-surface-400 bg-surface-100 rounded-lg px-3 py-2 mb-6 break-words">
              {this.state.message}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={this.handleReload} className="btn-primary">
              <svg className="w-4 h-4 inline mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reload Page
            </button>
            <button onClick={this.handleGoHome} className="btn-secondary">
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
