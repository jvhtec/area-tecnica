import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getExistingPushSubscription, isPushSupported } from '@/lib/push';

/**
 * Hook to detect when a user previously had push notifications enabled
 * but lost their subscription (e.g., after clearing browser data, reinstalling PWA)
 *
 * When detected, prompts the user to re-enable push notifications.
 *
 * Note: Due to browser security, we cannot automatically restore push subscriptions.
 * Users must explicitly grant permission again.
 */
export function usePushSubscriptionRecovery() {
  const hasPrompted = useRef(false);
  const isChecking = useRef(false);

  useEffect(() => {
    // Only check once per session
    if (hasPrompted.current || isChecking.current) {
      return;
    }

    // Only run if push is supported
    if (!isPushSupported()) {
      return;
    }

    isChecking.current = true;

    const checkForLostSubscription = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return; // Not logged in
        }

        // Check if user previously had push enabled
        const { data: profile } = await supabase
          .from('profiles')
          .select('push_notifications_enabled')
          .eq('id', user.id)
          .single();

        if (!profile?.push_notifications_enabled) {
          return; // User never enabled push or disabled it intentionally
        }

        // Check if they currently have a subscription
        const currentSubscription = await getExistingPushSubscription();

        if (currentSubscription) {
          return; // Subscription exists, all good!
        }

        // User had push enabled but subscription is lost
        // Show recovery prompt
        hasPrompted.current = true;

        toast.warning('Notificaciones push desactivadas', {
          description: 'Parece que perdiste tu suscripción de notificaciones push. ¿Quieres reactivarlas?',
          duration: 10000, // Show for 10 seconds
          action: {
            label: 'Reactivar',
            onClick: () => {
              // Navigate to notifications settings
              // User will need to manually re-enable
              window.location.hash = '#/profile'; // or wherever your push settings are
            },
          },
          cancel: {
            label: 'Ahora no',
            onClick: () => {
              // User dismissed - don't bother them again this session
            },
          },
        });

      } catch (error) {
        console.error('[Push Recovery] Failed to check for lost subscription:', error);
      } finally {
        isChecking.current = false;
      }
    };

    // Run check after a short delay to avoid blocking initial app load
    const timeoutId = setTimeout(() => {
      void checkForLostSubscription();
    }, 3000); // Wait 3 seconds after mount

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);
}
