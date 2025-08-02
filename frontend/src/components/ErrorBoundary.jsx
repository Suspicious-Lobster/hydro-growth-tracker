import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(_error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback 
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

const ErrorFallback = ({ error, errorInfo, onReset }) => {
  const { colors } = useTheme();

  return (
    <div className={`min-h-screen ${colors.bgPrimary} flex items-center justify-center p-4`}>
      <div className={`max-w-md w-full ${colors.bgSecondary} rounded-lg shadow-xl p-6 border ${colors.border}`}>
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="text-red-500" size={24} />
          <h2 className={`text-xl font-bold ${colors.text}`}>Oops! Something went wrong</h2>
        </div>
        
        <p className={`${colors.textMuted} mb-4`}>
          We're sorry, but something unexpected happened. Please try refreshing the page or contact support if the problem persists.
        </p>

        {import.meta.env.DEV && error && (
          <details className="mb-4">
            <summary className={`cursor-pointer ${colors.text} font-medium`}>
              Technical Details (Development Mode)
            </summary>
            <div className={`mt-2 p-3 bg-red-900/20 border border-red-500/30 rounded text-sm ${colors.text} font-mono`}>
              <p className="text-red-400 font-bold">{error.toString()}</p>
              {errorInfo && (
                <pre className="mt-2 text-xs overflow-auto">
                  {errorInfo.componentStack}
                </pre>
              )}
            </div>
          </details>
        )}

        <div className="flex gap-3">
          <button
            onClick={onReset}
            className={`flex-1 ${colors.primaryBg} text-white px-4 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2`}
          >
            <RefreshCw size={16} />
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className={`px-4 py-2 ${colors.bgAccent} ${colors.text} rounded-lg font-medium hover:opacity-80 transition-opacity border ${colors.border}`}
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorBoundary;
