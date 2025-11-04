import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary capturou um erro:', error, errorInfo);
    // Log mais detalhado no console
    console.error('Stack trace:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-8">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-red-400 mb-4">
              Oops! Algo deu errado
            </h1>
            <p className="text-gray-400 mb-4">
              Ocorreu um erro ao carregar a aplicação.
            </p>
            {this.state.error && (
              <details className="bg-[#1a1a1a] p-4 rounded border border-gray-800 mb-4">
                <summary className="cursor-pointer text-gray-300 mb-2">
                  Detalhes do erro
                </summary>
                <pre className="text-sm text-red-300 overflow-auto max-h-64">
                  <code className="block whitespace-pre-wrap break-words">
                    {this.state.error.toString()}
                  </code>
                  {this.state.error.stack && (
                    <code className="block mt-2 text-xs whitespace-pre-wrap break-words">
                      {this.state.error.stack}
                    </code>
                  )}
                </pre>
              </details>
            )}
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition-colors"
            >
              Recarregar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

