import { useEffect, useMemo } from "react";
import { useAppBadgeContext, type AppBadgeValue } from "@/providers/AppBadgeProvider";

export interface UseAppBadgeSourceOptions extends AppBadgeValue {
  /**
   * When true, the badge source will be active. When false, it will be removed.
   * Defaults to true when omitted.
   */
  enabled?: boolean;
}

export const useAppBadgeSource = (id: string, options?: UseAppBadgeSourceOptions | null) => {
  const { updateBadgeSource } = useAppBadgeContext();

  const normalizedOptions = useMemo(() => {
    if (!options || options.enabled === false) {
      return null;
    }

    const { enabled: _enabled, ...badgeValue } = options;
    return badgeValue as AppBadgeValue;
  }, [options]);

  useEffect(() => {
    updateBadgeSource(id, normalizedOptions);

    return () => {
      updateBadgeSource(id, null);
    };
  }, [id, normalizedOptions, updateBadgeSource]);
};
