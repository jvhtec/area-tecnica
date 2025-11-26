import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/utils/errorUtils';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

const RELOAD_KEY = 'app-reload-count';
const MAX_AUTO_RELOADS = 2;

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  private getReloadCount(): number {
    try {
      const count = sessionStorage.getItem(RELOAD_KEY);
      return count ? parseInt(count, 10) : 0;
    } catch {
      return 0;
    }
  }

  private incrementReloadCount(): void {
    try {
      const count = this.getReloadCount();
      sessionStorage.setItem(RELOAD_KEY, (count + 1).toString());
    } catch {
      // Ignore sessionStorage errors
    }
  }

  private clearReloadCount(): void {
    try {
      sessionStorage.removeItem(RELOAD_KEY);
    } catch {
      // Ignore sessionStorage errors
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled error captured by ErrorBoundary', error, errorInfo);

    // Auto-reload on chunk load errors (up to MAX_AUTO_RELOADS times)
    if (isChunkLoadError(error)) {
      const reloadCount = this.getReloadCount();

      if (reloadCount < MAX_AUTO_RELOADS) {
        console.log(`[ErrorBoundary] Chunk load error detected. Auto-reloading (${reloadCount + 1}/${MAX_AUTO_RELOADS})...`);
        this.incrementReloadCount();

        // Brief delay before reload to prevent too-fast reload loops
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        console.error('[ErrorBoundary] Max auto-reload attempts reached. Showing error UI.');
      }
    }
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

  componentDidMount() {
    // Clear reload count on successful mount - app loaded without errors
    this.clearReloadCount();
  }

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error && isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg w-full space-y-4 text-center">
            <h1 className="text-2xl font-semibold">
              {isChunkError ? 'Nueva versión disponible' : 'Algo salió mal'}
            </h1>
            <p className="text-muted-foreground text-sm">
              {isChunkError
                ? 'La aplicación se ha actualizado. Por favor, recarga la página para obtener la última versión.'
                : 'Encontramos un problema al cargar la aplicación. Intenta recargar la página o borra los datos locales si el error persiste.'}
            </p>
            {this.state.error?.message && !isChunkError && (
              <p className="text-xs text-muted-foreground truncate" title={this.state.error.message}>
                {this.state.error.message}
              </p>
            )}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={this.handleReload} className="w-full sm:w-auto">
                <RefreshCw className="h-4 w-4 mr-2" />
                Recargar
              </Button>
              {!isChunkError && (
                <Button variant="outline" onClick={this.handleClearStorage} className="w-full sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Borrar datos locales
                </Button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
