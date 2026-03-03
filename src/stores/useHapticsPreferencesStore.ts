import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'

export type HapticsIntensity = 'light' | 'medium' | 'strong'

export interface HapticsPreferencesState {
  hapticsEnabled: boolean
  hapticsIntensity: HapticsIntensity
  hasHydrated: boolean
  setHapticsEnabled: (enabled: boolean) => void
  setHapticsIntensity: (intensity: HapticsIntensity) => void
  setHasHydrated: (hasHydrated: boolean) => void
}

const noopStorage: StateStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}

const resolveStorage = () => {
  if (typeof window === 'undefined') {
    return noopStorage
  }

  return window.localStorage
}

export const useHapticsPreferencesStore = create<HapticsPreferencesState>()(
  persist(
    (set) => ({
      hapticsEnabled: true,
      hapticsIntensity: 'light',
      hasHydrated: false,
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setHapticsIntensity: (hapticsIntensity) => set({ hapticsIntensity }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'haptics-preferences',
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
        hapticsEnabled: state.hapticsEnabled,
        hapticsIntensity: state.hapticsIntensity,
      }),
      onRehydrateStorage: (state) => {
        state.setHasHydrated(true)
      },
    },
  ),
)

export const initializeHapticsPreferences = async () => {
  await useHapticsPreferencesStore.persist
    .rehydrate()
    .catch(() => useHapticsPreferencesStore.getState().setHasHydrated(true))
}
