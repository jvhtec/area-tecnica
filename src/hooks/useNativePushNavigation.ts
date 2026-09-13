import { useEffect } from "react";
import { PushNotifications, type ActionPerformed } from "@capacitor/push-notifications";
import { useNavigate } from "react-router-dom";

import { normalizeInternalPath } from "@/lib/internalNavigation";
import { isNativePushSupported } from "@/lib/push-native";

export function getNativeNotificationPath(action: ActionPerformed): string | null {
  const url = action.notification.data?.url;
  return normalizeInternalPath(typeof url === "string" ? url : null);
}

export function useNativePushNavigation(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNativePushSupported()) return;

    let disposed = false;
    let listener: { remove: () => Promise<void> } | null = null;

    void PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
      const path = getNativeNotificationPath(action);
      if (path) navigate(path);
    }).then((handle) => {
      if (disposed) void handle.remove();
      else listener = handle;
    }).catch((error) => {
      console.error("No se pudo activar la navegación de notificaciones nativas", error);
    });

    return () => {
      disposed = true;
      void listener?.remove();
    };
  }, [navigate]);
}
