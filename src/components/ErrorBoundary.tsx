import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled error captured by ErrorBoundary', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearStorage = () => {
    try {
      localStorage.clear();
    } catch (storageError) {
      console.warn('Failed to clear localStorage after an error', storageError);
    }
    this.handleReload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg w-full space-y-4 text-center">
            <h1 className="text-2xl font-semibold">Algo salió mal</h1>
            <p className="text-muted-foreground text-sm">
              Encontramos un problema al cargar la aplicación. Intenta recargar la página o borra los datos locales si el error persiste.
            </p>
            {this.state.error?.message && (
              <p className="text-xs text-muted-foreground truncate" title={this.state.error.message}>
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={this.handleReload} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recargar
              </Button>
              <Button variant="outline" onClick={this.handleClearStorage} className="w-full sm:w-auto">
                <Trash2 className="h-4 w-4 mr-2" />
                Borrar datos locales
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
