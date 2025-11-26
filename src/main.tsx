import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Global error handler for chunk load errors that happen outside React's error boundary
const RELOAD_KEY = 'global-chunk-error-reload';
const MAX_RELOADS = 2;

const isChunkLoadError = (error: ErrorEvent | PromiseRejectionEvent): boolean => {
  const message = error instanceof ErrorEvent
    ? error.message || error.error?.message || ''
    : error.reason?.message || String(error.reason) || '';

  const chunkFailurePatterns = [
    /Loading chunk [\d]+ failed/i,
    /ChunkLoadError/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
  ];

  return chunkFailurePatterns.some((pattern) => pattern.test(message));
};

const handleChunkLoadError = () => {
  try {
    const count = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10);

    if (count < MAX_RELOADS) {
      console.log(`[Global] Chunk load error detected. Auto-reloading (${count + 1}/${MAX_RELOADS})...`);
      sessionStorage.setItem(RELOAD_KEY, (count + 1).toString());
      setTimeout(() => window.location.reload(), 500);
    } else {
      console.error('[Global] Max chunk error reload attempts reached.');
    }
  } catch {
    // If sessionStorage fails, just reload once
    window.location.reload();
  }
};

// Clear reload counter on successful load
try {
  sessionStorage.removeItem(RELOAD_KEY);
} catch {
  // Ignore
}

// Listen for unhandled promise rejections (e.g., dynamic import failures)
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadError(event)) {
    event.preventDefault();
    handleChunkLoadError();
  }
});

// Listen for global errors
window.addEventListener('error', (event) => {
  if (isChunkLoadError(event)) {
    event.preventDefault();
    handleChunkLoadError();
  }
});

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(<App />)

const shouldRegisterServiceWorker = (() => {
  if (!('serviceWorker' in navigator)) {
    return false
  }

  if (import.meta.env.PROD) {
    return true
  }

  const { hostname, protocol } = window.location

  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1'
  const isSecure = window.isSecureContext || protocol === 'https:'

  return isLocalhost || isSecure
})()

if (shouldRegisterServiceWorker) {
  const registerServiceWorker = async () => {
    try {
      const existingRegistration = await navigator.serviceWorker.getRegistration('/')
      const registration =
        existingRegistration ??
        (await navigator.serviceWorker.register('/sw.js', { scope: '/' }))

      try {
        await registration.update()
      } catch (updateError) {
        if (import.meta.env.DEV) {
          console.warn('Service worker update check failed', updateError)
        }
      }
    } catch (error) {
      console.error('Service worker registration failed', error)
    }
  }

  void registerServiceWorker()
}
