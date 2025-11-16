import { supabase } from '@/lib/supabase'

type SystemName = 'timesheets' | 'assignments'

export interface ErrorTrackingContext {
  system: SystemName
  operation: string
  userId?: string | null
  [key: string]: any
}

const normalizeError = (error: unknown): Error => {
  if (error instanceof Error) return error
  if (typeof error === 'string') return new Error(error)
  try {
    return new Error(JSON.stringify(error))
  } catch {
    return new Error('Unknown error')
  }
}

const sanitizeContext = (context: ErrorTrackingContext) => {
  return JSON.parse(
    JSON.stringify(context, (_key, value) => {
      if (value instanceof Date) return value.toISOString()
      return value
    })
  )
}

export const trackError = async (error: unknown, context: ErrorTrackingContext) => {
  const normalized = normalizeError(error)
  const payloadContext = sanitizeContext(context)

  try {
    await supabase.from('system_errors').insert({
      system: context.system,
      error_type: normalized.name,
      error_message: normalized.message,
      context: payloadContext,
      user_id: context.userId ?? null,
    })
  } catch (loggingError) {
    console.error('[monitoring] Failed to record error context', loggingError)
  } finally {
    console.error(`[${context.system}] ${context.operation}:`, normalized)
  }
}
