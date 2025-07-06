import React from 'react';
import { AlertCircle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ExcalidrawErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset?: () => void },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Excalidraw error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center bg-obsidian-bg text-obsidian-text p-8">
          <AlertCircle size={48} className="text-obsidian-error mb-4" />
          <h2 className="text-xl font-semibold mb-2">ERROR</h2>
          <p className="text-obsidian-text-muted mb-4 text-center max-w-md">
            error
          </p>
          <div className="flex space-x-4">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-obsidian-accent hover:bg-obsidian-accent-hover text-white rounded transition-colors"
            >
              retry
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-obsidian-bg-secondary hover:bg-obsidian-bg-tertiary rounded transition-colors"
            >
              F5
            </button>
          </div>
          {this.state.error && (
            <details className="mt-4 text-xs text-obsidian-text-muted">
              <summary className="cursor-pointer">sum:</summary>
              <pre className="mt-2 p-2 bg-obsidian-bg-secondary rounded overflow-auto max-w-xl">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ExcalidrawErrorBoundary;