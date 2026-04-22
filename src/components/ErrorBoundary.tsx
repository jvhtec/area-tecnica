import React from 'react';
import { RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/utils/errorUtils';
import {
  CHUNK_ERROR_RELOAD_KEY,
  CHUNK_ERROR_RELOAD_OWNER_KEY,
  CHUNK_ERROR_RELOAD_OWNER_TTL_MS,
  MAX_CHUNK_ERROR_RELOADS,
} from '@/utils/chunkErrorConstants';
import { recordBoundaryError } from '@/utils/errorTelemetry';

export type ErrorBoundaryFallbackRender = (args: {
  error: Error;
  reset: () => void;
  reload: () => void;
}) => React.ReactNode;

type ErrorBoundaryProps = {
  children: React.ReactNode;
  /** When any of these values change, the boundary resets and re-renders children. */
  resetKeys?: ReadonlyArray<unknown>;
  /** If true, the boundary renders nothing when it catches an error (non-critical UI). */
  silent?: boolean;
  /** Optional label used when logging / reporting the error. */
  boundaryName?: string;
  /** Custom render for the fallback UI. Receives error and reset/reload callbacks. */
  fallback?: ErrorBoundaryFallbackRender;
  /** Optional side-effect when an error is caught (e.g. for tests / custom telemetry). */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

function areResetKeysEqual(a: ReadonlyArray<unknown> = [], b: ReadonlyArray<unknown> = []): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false;
  }
  return true;
}

function generateOwnerId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to fallback
  }
  return `eb-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  private clearTimeoutId?: ReturnType<typeof setTimeout>;
  // Unique per-instance id used to scope the chunk-reload counter so sibling
  // boundaries cannot clear a counter another instance just incremented.
  private readonly ownerId: string = generateOwnerId();

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
      sessionStorage.setItem(
        CHUNK_ERROR_RELOAD_OWNER_KEY,
        JSON.stringify({ ownerId: this.ownerId, ts: Date.now() }),
      );
    } catch {
      // Ignore sessionStorage errors
    }
  }

  /**
   * Clears the reload counter only if this instance "owns" it (i.e. incremented
   * it last) or if the owner entry is stale. Sibling boundaries whose mount
   * timer fires while another boundary has an in-flight reload must not wipe
   * the counter, or MAX_CHUNK_ERROR_RELOADS can be bypassed on every reload.
   */
  private maybeClearReloadCount(): void {
    try {
      const countRaw = sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY);
      if (!countRaw) {
        // Counter already cleared (usually by main.tsx on successful load).
        // Remove any orphan ownership entry so it can't haunt a later cycle.
        sessionStorage.removeItem(CHUNK_ERROR_RELOAD_OWNER_KEY);
        return;
      }

      const ownerRaw = sessionStorage.getItem(CHUNK_ERROR_RELOAD_OWNER_KEY);
      if (!ownerRaw) {
        // Counter exists but no owner metadata — legacy or external write.
        // Treat as unowned and clear it (matches the prior behaviour).
        sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
        return;
      }

      let parsed: { ownerId?: string; ts?: number } | null = null;
      try {
        parsed = JSON.parse(ownerRaw);
      } catch {
        parsed = null;
      }

      const isOwner = parsed?.ownerId === this.ownerId;
      const age = Date.now() - (Number(parsed?.ts) || 0);
      const isStale = age > CHUNK_ERROR_RELOAD_OWNER_TTL_MS;

      if (isOwner || isStale) {
        sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
        sessionStorage.removeItem(CHUNK_ERROR_RELOAD_OWNER_KEY);
      }
      // Otherwise another boundary owns the in-flight counter — leave alone.
    } catch {
      // Ignore sessionStorage errors
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { boundaryName, onError, silent } = this.props;
    const label = boundaryName ?? 'ErrorBoundary';

    console.error(`[${label}] Unhandled error captured`, error, errorInfo);

    try {
      recordBoundaryError({
        boundary: label,
        message: error.message,
        name: error.name,
        stack: error.stack,
        componentStack: errorInfo.componentStack ?? undefined,
        url: typeof window !== 'undefined' ? window.location.pathname : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        silent: Boolean(silent),
        timestamp: new Date().toISOString(),
      });
    } catch (telemetryError) {
      console.warn('[ErrorBoundary] Failed to record telemetry', telemetryError);
    }

    if (onError) {
      try {
        onError(error, errorInfo);
      } catch (hookError) {
        console.warn('[ErrorBoundary] onError callback threw', hookError);
      }
    }

    // Cancel the reload count clear timeout if error occurs
    if (this.clearTimeoutId) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = undefined;
    }

    // Auto-reload on chunk load errors (up to MAX_CHUNK_ERROR_RELOADS times)
    if (isChunkLoadError(error)) {
      const reloadCount = this.getReloadCount();

      if (reloadCount < MAX_CHUNK_ERROR_RELOADS) {
        console.log(`[${label}] Chunk load error detected. Auto-reloading (${reloadCount + 1}/${MAX_CHUNK_ERROR_RELOADS})...`);
        this.incrementReloadCount();

        // Brief delay before reload to prevent too-fast reload loops
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        console.error(`[${label}] Max auto-reload attempts reached. Showing error UI.`);
      }
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
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
    // Clear reload count after a short delay to ensure child components have rendered
    // This prevents clearing the count before initial render errors might occur.
    // Only this instance's counter (or a stale one) is cleared — see maybeClearReloadCount.
    this.clearTimeoutId = setTimeout(() => {
      this.maybeClearReloadCount();
      this.clearTimeoutId = undefined;
    }, 1000); // 1 second delay after mount
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (!this.state.hasError) return;
    if (!areResetKeysEqual(prevProps.resetKeys, this.props.resetKeys)) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  componentWillUnmount() {
    // Clean up timeout if component unmounts before it fires
    if (this.clearTimeoutId) {
      clearTimeout(this.clearTimeoutId);
      this.clearTimeoutId = undefined;
    }
  }

  render() {
    if (!this.state.hasError || !this.state.error) {
      return this.props.children;
    }

    if (this.props.silent) {
      return null;
    }

    if (this.props.fallback) {
      return this.props.fallback({
        error: this.state.error,
        reset: this.handleReset,
        reload: this.handleReload,
      });
    }

    const isChunkError = isChunkLoadError(this.state.error);

    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground p-6">
        <div className="max-w-lg w-full space-y-4 text-center">
          <h1 className="text-2xl font-semibold">
            {isChunkError ? 'Nueva versión disponible' : 'Algo salió mal'}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isChunkError
              ? 'La aplicación se ha actualizado. Por favor, recarga la página para obtener la última versión.'
              : 'Encontramos un problema inesperado. Puedes intentar continuar, recargar la página o borrar los datos locales si el error persiste.'}
          </p>
          {this.state.error?.message && !isChunkError && (
            <p
              className="text-xs text-muted-foreground truncate"
              title={import.meta.env.DEV ? this.state.error.message : undefined}
            >
              {import.meta.env.DEV
                ? this.state.error.message
                : 'Ha ocurrido un error. Por favor, inténtelo más tarde.'}
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {!isChunkError && (
              <Button onClick={this.handleReset} variant="secondary" className="w-full sm:w-auto">
                <RotateCcw className="h-4 w-4 mr-2" />
                Intentar de nuevo
              </Button>
            )}
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
}

export default ErrorBoundary;