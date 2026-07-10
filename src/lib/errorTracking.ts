import { supabase } from '@/lib/supabase'

type SystemName = 'timesheets' | 'assignments'

export interface ErrorTrackingContext {
  system: SystemName
  operation: string
  userId?: string | null
  [key: string]: unknown
}

const REDACTED_CONTEXT_KEYS = /(?:authorization|password|token|secret|api.?key|cookie|email|phone|dni|address|signed.?url|body|payload)/i
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const URL_QUERY_PATTERN = /https?:\/\/[^\s?]+\?[^\s]+/gi

export const redactErrorText = (value: string): string => value
  .replace(EMAIL_PATTERN, '[REDACTED_EMAIL]')
  .replace(URL_QUERY_PATTERN, '[REDACTED_URL]')
  .slice(0, 500)

const sanitizeValue = (value: unknown, key?: string, depth = 0): unknown => {
  if (key && REDACTED_CONTEXT_KEYS.test(key)) return '[REDACTED]'
  if (depth > 4) return '[MAX_DEPTH]'
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return { name: value.name, message: redactErrorText(value.message) }
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, undefined, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).slice(0, 50).map(([childKey, childValue]) => [
      childKey,
      sanitizeValue(childValue, childKey, depth + 1),
    ]))
  }
  if (typeof value === 'string') return redactErrorText(value)
  return typeof value === 'bigint' ? value.toString() : value
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

export const sanitizeErrorContext = (context: ErrorTrackingContext) => sanitizeValue(context) as Record<string, unknown>

export const trackError = async (error: unknown, context: ErrorTrackingContext) => {
  const normalized = normalizeError(error)
  const payloadContext = sanitizeErrorContext(context)
  const safeUserId = typeof context.userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(context.userId)
    ? context.userId
    : null

  try {
    const { error: dbError } = await supabase.from('system_errors').insert({
      system: context.system,
      error_type: normalized.name,
      error_message: redactErrorText(normalized.message),
      context: payloadContext,
      user_id: safeUserId,
    })
    if (dbError) {
      throw dbError
    }
  } catch (loggingError) {
    console.error('[monitoring] Failed to record error context', loggingError)
  } finally {
    console.error(`[${context.system}] ${context.operation}:`, {
      name: normalized.name,
      message: redactErrorText(normalized.message),
    })
  }
}
