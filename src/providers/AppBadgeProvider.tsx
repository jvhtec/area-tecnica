import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AppBadgeValue {
  count?: number;
  isDot?: boolean;
}

interface AppBadgeContextValue {
  updateBadgeSource: (id: string, value: AppBadgeValue | null) => void;
}

const AppBadgeContext = createContext<AppBadgeContextValue | undefined>(undefined);

const supportsAppBadging = () =>
  typeof window !== "undefined" &&
  typeof navigator !== "undefined" &&
  ("setAppBadge" in navigator || "clearAppBadge" in navigator);

const normalizeCount = (value?: number) => {
  if (typeof value !== "number") {
    return undefined;
  }

  if (!Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.floor(value));
};

export const AppBadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeSources, setBadgeSources] = useState<Record<string, AppBadgeValue>>({});
  const isSupported = useMemo(() => supportsAppBadging(), []);

  const updateBadgeSource = useCallback((id: string, value: AppBadgeValue | null) => {
    setBadgeSources(previous => {
      if (!value) {
        if (!(id in previous)) {
          return previous;
        }

        const { [id]: _removed, ...rest } = previous;
        return rest;
      }

      const normalized: AppBadgeValue = {
        ...value,
      };

      const existing = previous[id];
      if (existing && existing.count === normalized.count && existing.isDot === normalized.isDot) {
        return previous;
      }

      return {
        ...previous,
        [id]: normalized,
      };
    });
  }, []);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const nav = navigator as Navigator;
    const sources = Object.values(badgeSources);
    const totalCount = sources.reduce((accumulator, source) => {
      const normalized = normalizeCount(source.count);
      if (typeof normalized === "number" && normalized > 0) {
        return accumulator + normalized;
      }
      return accumulator;
    }, 0);

    const hasDotSource = sources.some(source => {
      const normalized = normalizeCount(source.count);
      if (typeof normalized === "number" && normalized > 0) {
        return false;
      }
      return source.isDot === true;
    });

    const applyBadge = async () => {
      try {
        if ("setAppBadge" in nav && typeof nav.setAppBadge === "function") {
          if (totalCount > 0) {
            await nav.setAppBadge(totalCount);
            return;
          }

          if (hasDotSource) {
            await nav.setAppBadge();
            return;
          }
        }

        if ("clearAppBadge" in nav && typeof nav.clearAppBadge === "function") {
          await nav.clearAppBadge();
        } else if ("setAppBadge" in nav && typeof nav.setAppBadge === "function") {
          await nav.setAppBadge(0);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Unable to update app badge", error);
        }

        try {
          if ("clearAppBadge" in nav && typeof nav.clearAppBadge === "function") {
            await nav.clearAppBadge();
          }
        } catch (clearError) {
          if (import.meta.env.DEV) {
            console.warn("Unable to clear app badge", clearError);
          }
        }
      }
    };

    void applyBadge();
  }, [badgeSources, isSupported]);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    const nav = navigator as Navigator;

    return () => {
      if ("clearAppBadge" in nav && typeof nav.clearAppBadge === "function") {
        void nav.clearAppBadge();
      } else if ("setAppBadge" in nav && typeof nav.setAppBadge === "function") {
        void nav.setAppBadge(0);
      }
    };
  }, [isSupported]);

  const contextValue = useMemo(() => ({ updateBadgeSource }), [updateBadgeSource]);

  return (
    <AppBadgeContext.Provider value={contextValue}>
      {children}
    </AppBadgeContext.Provider>
  );
};

export const useAppBadgeContext = () => {
  const context = useContext(AppBadgeContext);

  if (!context) {
    throw new Error("useAppBadgeContext must be used within an AppBadgeProvider");
  }

  return context;
};
