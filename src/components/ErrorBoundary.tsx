import React from 'react';
import { RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/utils/errorUtils';
import { CHUNK_ERROR_RELOAD_KEY, MAX_CHUNK_ERROR_RELOADS } from '@/utils/chunkErrorConstants';

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  private clearTimeoutId?: ReturnType<typeof setTimeout>;

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  private getReloadCount(): number {
    try {
      const count = sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY);
      return count ? parseInt(count, 10) : 0;
    } catch {
      return 0;
    }
  }

  private incrementReloadCount(): void {
    try {
      const count = this.getReloadCount();
      sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, (count + 1).toString());
    } catch {
      // Ignore sessionStorage errors
    }
  }

  private clearReloadCount(): void {
    try {
      sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
    } catch {
      // Ignore sessionStorage errors
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled error captured by ErrorBoundary', error, errorInfo);

    // Cancel the reload count clear timeout if error occurs
    if (this.clearTimeoutId) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = undefined;
    }

    // Auto-reload on chunk load errors (up to MAX_CHUNK_ERROR_RELOADS times)
    if (isChunkLoadError(error)) {
      const reloadCount = this.getReloadCount();

      if (reloadCount < MAX_CHUNK_ERROR_RELOADS) {
        console.log(`[ErrorBoundary] Chunk load error detected. Auto-reloading (${reloadCount + 1}/${MAX_CHUNK_ERROR_RELOADS})...`);
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

  private handleClearStorage = async () => {
    try {
      localStorage.clear();
    } catch (storageError) {
      console.warn('Failed to clear localStorage after an error', storageError);
    }

    try {
      sessionStorage.clear();
    } catch {
      // ignore
    }

    // Best-effort: clear Service Worker + Cache Storage to avoid stale JS bundles.
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.allSettled(regs.map((r) => r.unregister()));
      }
    } catch {
      // ignore
    }

    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore
    }

    // Best-effort: clear IndexedDB (some browsers support databases()).
    try {
      const anyIDB: any = indexedDB as any;
      if (typeof anyIDB?.databases === 'function') {
        const dbs = await anyIDB.databases();
        await Promise.allSettled(
          (dbs || [])
            .map((d: any) => d?.name)
            .filter(Boolean)
            .map((name: string) =>
              new Promise<void>((resolve) => {
                const req = indexedDB.deleteDatabase(name);
                req.onsuccess = () => resolve();
                req.onerror = () => resolve();
                req.onblocked = () => resolve();
              })
            )
        );
      }
    } catch {
      // ignore
    }

    // Hard reload with cache-bust.
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('cb', Date.now().toString());
      window.location.replace(url.toString());
      return;
    } catch {
      // fallback
    }

    this.handleReload();
  };

  componentDidMount() {
    // Clear reload count after a short delay to ensure child components have rendered
    // This prevents clearing the count before initial render errors might occur
    this.clearTimeoutId = setTimeout(() => {
      this.clearReloadCount();
      this.clearTimeoutId = undefined;
    }, 1000); // 1 second delay after mount
  }

  componentWillUnmount() {
    // Clean up timeout if component unmounts before it fires
    if (this.clearTimeoutId) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = undefined;
    }
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
