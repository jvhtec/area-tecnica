import * as React from 'react'
import { toast } from 'sonner'

import { haptics } from '@/lib/haptics'

type ToastOptions = {
  description?: string
}

type HapticToastOptions = ToastOptions & {
  haptic?: boolean
}

const shouldHaptic = (enabled?: boolean) => enabled !== false

export const hapticToast = {
  success: (title: string, options?: HapticToastOptions) => {
    if (shouldHaptic(options?.haptic)) {
      void haptics.success()
    }

    return toast.success(title, { description: options?.description })
  },
  error: (title: string, options?: HapticToastOptions) => {
    if (shouldHaptic(options?.haptic)) {
      void haptics.error()
    }

    return toast.error(title, { description: options?.description })
  },
  warning: (title: string, options?: HapticToastOptions) => {
    if (shouldHaptic(options?.haptic)) {
      void haptics.warning()
    }

    return toast.warning(title, { description: options?.description })
  },
  info: (title: string, options?: HapticToastOptions) => {
    if (shouldHaptic(options?.haptic)) {
      void haptics.tap()
    }

    return toast.info(title, { description: options?.description })
  },
  destructiveConfirm: () => {
    void haptics.warning()
  },
}

export const useHapticToast = () => {
  return React.useMemo(() => hapticToast, [])
}
