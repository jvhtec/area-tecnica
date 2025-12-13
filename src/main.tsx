import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { isChunkLoadErrorEvent, isChunkLoadPromiseRejection } from '@/utils/errorUtils'
import { CHUNK_ERROR_RELOAD_KEY, MAX_CHUNK_ERROR_RELOADS } from '@/utils/chunkErrorConstants'
import { initConsoleCapture } from '@/utils/consoleCapture'

// Initialize console capture globally to capture logs throughout the app lifecycle
initConsoleCapture();

// Global error handler for chunk load errors that happen outside React's error boundary
// In-memory guard to prevent infinite reload loops if sessionStorage is unavailable
declare global {
  interface Window {
    __chunkErrorReloadAttempted?: boolean;
  }
}

const handleChunkLoadError = () => {
  try {
    const count = parseInt(sessionStorage.getItem(CHUNK_ERROR_RELOAD_KEY) || '0', 10);

    if (count < MAX_CHUNK_ERROR_RELOADS) {
      console.log(`[Global] Chunk load error detected. Auto-reloading (${count + 1}/${MAX_CHUNK_ERROR_RELOADS})...`);
      sessionStorage.setItem(CHUNK_ERROR_RELOAD_KEY, (count + 1).toString());
      setTimeout(() => window.location.reload(), 500);
    } else {
      console.error('[Global] Max chunk error reload attempts reached.');
    }
  } catch (error) {
    // If sessionStorage fails, use in-memory guard to prevent infinite reload loops
    console.error('[Global] SessionStorage unavailable:', error);

    if (!window.__chunkErrorReloadAttempted) {
      console.log('[Global] Attempting one-time reload with in-memory guard...');
      window.__chunkErrorReloadAttempted = true;
      setTimeout(() => window.location.reload(), 500);
    } else {
      console.error('[Global] In-memory reload guard prevented infinite loop. Not reloading.');
    }
  }
};

// Clear reload counter on successful load
try {
  sessionStorage.removeItem(CHUNK_ERROR_RELOAD_KEY);
} catch {
  // Ignore - will be handled by ErrorBoundary after mount delay
}

// Listen for unhandled promise rejections (e.g., dynamic import failures)
window.addEventListener('unhandledrejection', (event) => {
  if (isChunkLoadPromiseRejection(event)) {
    event.preventDefault();
    handleChunkLoadError();
  }
});

// Listen for global errors
window.addEventListener('error', (event) => {
  if (isChunkLoadErrorEvent(event)) {
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

      // iOS PWA: Add visibility change listener for update checking
      // iOS doesn't always check for updates on app launch, but does better with visibility changes
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator as any).standalone === true;

      if (isIOS) {
        let lastCheckTime = Date.now();

        const handleVisibilityChange = async () => {
          // Only check if app became visible and it's been at least 10 seconds since last check
          if (!document.hidden && Date.now() - lastCheckTime > 10000) {
            lastCheckTime = Date.now();
            console.log('[Main] iOS: Visibility changed, checking for SW updates');

            try {
              const reg = await navigator.serviceWorker.getRegistration('/');
              if (reg) {
                await reg.update();
              }
            } catch (err) {
              console.debug('[Main] iOS: Update check failed', err);
            }
          }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
    } catch (error) {
      console.error('Service worker registration failed', error)
    }
  }

  void registerServiceWorker()
}
