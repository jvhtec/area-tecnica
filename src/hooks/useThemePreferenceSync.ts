import { useEffect } from "react";
import { useTheme } from "next-themes";

import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import {
  explicitPreferenceFromDarkMode,
  getStoredThemePreference,
  migrateLegacyThemePreference,
  persistExplicitThemePreference,
} from "@/lib/theme";
import { dataLayerClient } from "@/services/dataLayerClient";

export const useThemePreferenceSync = () => {
  const { user, isLoading } = useOptimizedAuth();
  const { setTheme } = useTheme();

  useEffect(() => {
    if (isLoading || !user?.id) {
      return;
    }

    const localPreference = migrateLegacyThemePreference();
    if (localPreference) {
      setTheme(localPreference);
      return;
    }

    let cancelled = false;

    const loadDatabaseFallback = async () => {
      const { data, error } = await dataLayerClient
        .from("profiles")
        .select("dark_mode")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled || error || typeof data?.dark_mode !== "boolean") {
        return;
      }

      if (getStoredThemePreference()) {
        return;
      }

      const preference = explicitPreferenceFromDarkMode(data.dark_mode);
      persistExplicitThemePreference(preference);
      setTheme(preference);
    };

    loadDatabaseFallback();

    return () => {
      cancelled = true;
    };
  }, [isLoading, setTheme, user?.id]);
};
