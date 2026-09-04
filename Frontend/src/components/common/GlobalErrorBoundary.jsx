import React from 'react';
import { FiRefreshCw, FiHome, FiAlertCircle, FiWifiOff, FiServer } from 'react-icons/fi';
import Logo from './Logo';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
    };
    this.handleOnline = this.handleOnline.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[GlobalErrorBoundary] Unhandled application error caught:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  componentDidMount() {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('appNetworkRestored', this.handleOnline);
  }

  componentWillUnmount() {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('appNetworkRestored', this.handleOnline);
  }

  handleOnline() {
    // If the error was due to network / chunk loading and connection is restored, auto retry
    if (this.state.hasError) {
      console.log('[GlobalErrorBoundary] Network restored, attempting auto-recovery...');
      this.handleRetry();
    }
  }

  handleRetry = () => {
    this.setState({ isRetrying: true });
    setTimeout(() => {
      // Clear error state or reload page cleanly
      this.setState({ hasError: false, error: null, errorInfo: null, isRetrying: false });
      window.location.reload();
    }, 600);
  };

  isNetworkOrChunkError = () => {
    const msg = this.state.error?.message?.toLowerCase() || '';
    return (
      msg.includes('fetch') ||
      msg.includes('dynamically imported module') ||
      msg.includes('loading chunk') ||
      msg.includes('network') ||
      msg.includes('failed to load') ||
      !navigator.onLine
    );
  };

  render() {
    if (this.state.hasError) {
      const isNetworkIssue = this.isNetworkOrChunkError();

      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-teal-50/20 flex flex-col justify-between py-8 px-4 sm:px-6 relative overflow-hidden">
          {/* Background Ambient Glow */}
          <div className="absolute top-10 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#347989]/5 rounded-full blur-3xl pointer-events-none" />
          
          {/* Header */}
          <div className="w-full max-w-lg mx-auto flex justify-center pt-2">
            <Logo className="h-10 sm:h-12 w-auto" />
          </div>

          {/* Error Card */}
          <div className="w-full max-w-md mx-auto my-auto bg-white/90 backdrop-blur-xl border border-gray-100 rounded-3xl shadow-2xl shadow-gray-200/60 p-6 sm:p-8 text-center relative z-10">
            {/* Animated Icon */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-2xl bg-amber-50 flex items-center justify-center border border-amber-100 text-amber-500 shadow-inner">
              {isNetworkIssue ? (
                <FiWifiOff className="w-10 h-10 animate-pulse text-[#347989]" />
              ) : (
                <FiServer className="w-10 h-10 text-rose-500 animate-bounce" />
              )}
            </div>

            {/* Error Titles */}
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-2">
              {isNetworkIssue ? 'Connection Interrupted' : 'Internal Server Error'}
            </h1>
            
            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
              {isNetworkIssue
                ? 'We encountered a momentary network switch or connection loss. Please verify your internet or tap below to reconnect.'
                : 'Something unexpected occurred while processing this page. Our team has been notified and we are working to resolve it.'}
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                onClick={this.handleRetry}
                disabled={this.state.isRetrying}
                className="w-full py-3.5 px-5 bg-gradient-to-r from-[#347989] to-[#255662] hover:from-[#2c6775] hover:to-[#1b414a] text-white font-bold rounded-xl shadow-lg shadow-[#347989]/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-75 cursor-pointer"
              >
                <FiRefreshCw className={`w-4 h-4 ${this.state.isRetrying ? 'animate-spin' : ''}`} />
                <span>{this.state.isRetrying ? 'Reconnecting...' : 'Retry Connection'}</span>
              </button>

              <button
                onClick={() => {
                  window.location.href = '/user';
                }}
                className="w-full py-3 px-5 bg-gray-100 hover:bg-gray-200/80 text-gray-700 font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-sm"
              >
                <FiHome className="w-4 h-4 text-gray-500" />
                <span>Return to Home</span>
              </button>
            </div>

            {/* Dev details in development mode */}
            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left bg-gray-50 p-3 rounded-xl border border-gray-200/80 max-h-36 overflow-auto">
                <summary className="text-xs font-mono font-bold text-gray-500 cursor-pointer mb-1">
                  Debug Details (Dev Only)
                </summary>
                <pre className="text-[11px] font-mono text-red-600 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>

          {/* Footer */}
          <div className="w-full text-center text-xs text-gray-400 pb-2">
            &copy; {new Date().getFullYear()} Truliq. All rights reserved.
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
