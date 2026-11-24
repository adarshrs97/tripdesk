// ==============================================================================
// Milestone 9: Global Error Boundary Component
// Catches unhandled React runtime exceptions and displays graceful recovery UI
// ==============================================================================

import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home, Copy, Check } from 'lucide-react';
import { Logger } from '../../services/logger';

interface Props {
  children: ReactNode;
  fallbackView?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    Logger.error('Unhandled React component exception caught by ErrorBoundary', error, {
      componentStack: errorInfo.componentStack,
    });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.hash = 'dashboard';
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleCopyDiagnostics = (): void => {
    const diag = [
      `Starciti Diagnostic Report - ${new Date().toISOString()}`,
      `Error: ${this.state.error?.message}`,
      `Stack: ${this.state.error?.stack}`,
      `Component: ${this.state.errorInfo?.componentStack}`,
      `URL: ${window.location.href}`,
    ].join('\n\n');

    navigator.clipboard.writeText(diag).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallbackView) {
        return this.props.fallbackView;
      }

      return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-6 text-ink">
          <div className="bg-card border border-line rounded-2xl p-8 max-w-lg w-full shadow-lg space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red/10 border border-red/20 flex items-center justify-center shrink-0">
                <AlertOctagon className="w-6 h-6 text-red" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-ink">Application View Error</h1>
                <p className="text-xs text-ink-soft mt-0.5">
                  An unexpected error occurred while rendering this view.
                </p>
              </div>
            </div>

            <div className="bg-paper border border-line rounded-xl p-4 font-mono text-xs text-ink-soft overflow-x-auto max-h-40">
              <span className="text-red font-semibold">{this.state.error?.name}: </span>
              {this.state.error?.message || 'Unknown runtime exception'}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-semibold hover:bg-brand-dark transition-colors shadow-xs"
              >
                <RotateCcw className="w-4 h-4" />
                Reload Page
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-card border border-line rounded-xl text-xs font-semibold hover:bg-paper transition-colors"
              >
                <Home className="w-4 h-4 text-ink-soft" />
                Return to Desk
              </button>
            </div>

            <div className="pt-2 border-t border-line flex justify-between items-center text-xs">
              <span className="text-ink-soft">Diagnostics logged for review</span>
              <button
                onClick={this.handleCopyDiagnostics}
                className="inline-flex items-center gap-1.5 text-brand hover:text-brand-dark font-medium"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Copied Report!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Diagnostic Details</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
