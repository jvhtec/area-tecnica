import { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';

/**
 * Detect if the app is running as an installed PWA
 */
const isPWAMode = (): boolean => {
  // Check if running in standalone mode (installed PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }

  // iOS Safari specific check
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  return false;
};

/**
 * Hook to handle service worker updates with user-friendly notifications
 *
 * This hook:
 * 1. Detects when a new service worker is available
 * 2. Shows a toast notification to the user (works for both logged-in and non-logged-in users)
 * 3. Provides different messaging for PWA vs browser users
 * 4. Allows the user to trigger the update
 * 5. Reloads the page when the new SW takes control
 */
export function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const refreshing = useRef(false);
  const toastId = useRef<string | number | undefined>(undefined);
  const isStandalone = isPWAMode();

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      setWaitingWorker(registration.waiting);
      setUpdateAvailable(true);

      // Customize messaging based on PWA vs browser mode
      const title = isStandalone
        ? 'Nueva versión disponible'
        : 'Actualización disponible';

      const description = isStandalone
        ? 'Hay una actualización de la aplicación lista. Actualiza ahora para obtener las últimas mejoras.'
        : 'Hay una actualización disponible. Recarga la página para obtener la última versión.';

      // Show toast notification
      toastId.current = toast.info(title, {
        description,
        duration: Infinity, // Don't auto-dismiss
        action: {
          label: 'Actualizar',
          onClick: () => {
            if (registration.waiting) {
              try {
                // Send SKIP_WAITING message to the waiting service worker
                registration.waiting.postMessage({ type: 'SKIP_WAITING' });
              } catch (error) {
                console.error('[SW Update] Failed to send SKIP_WAITING message:', error);
                // Fallback: just reload the page to get the new version
                window.location.reload();
              }
            }
          },
        },
        cancel: isStandalone ? undefined : {
          label: 'Más tarde',
          onClick: () => {
            // User dismissed the notification
          },
        },
      });
    };

    // Check for existing waiting worker
    navigator.serviceWorker.ready.then((registration) => {
      if (registration.waiting) {
        handleUpdate(registration);
      }

      // Listen for new service worker installations
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          // When the new worker is installed and there's already a controller
          // (meaning this isn't the first install), show the update notification
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            handleUpdate(registration);
          }
        });
      });
    });

    // Listen for the new service worker to take control
    // When it does, reload the page to get the new assets
    const handleControllerChange = () => {
      if (!refreshing.current) {
        refreshing.current = true;

        // Dismiss the toast if it's still showing
        if (toastId.current !== undefined) {
          toast.dismiss(toastId.current);
        }

        // Show a brief "updating" message
        toast.loading('Aplicando actualización...', { duration: 1000 });

        // Reload the page after a brief delay
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);

      // Dismiss the toast when component unmounts
      if (toastId.current !== undefined) {
        toast.dismiss(toastId.current);
      }
    };
  }, []);

  return {
    updateAvailable,
    waitingWorker,
  };
}
