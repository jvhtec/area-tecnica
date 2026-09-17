import type { Json } from '@/integrations/supabase/types'
import { dataLayerClient } from '@/services/dataLayerClient'

export type NotificationInboxItem = {
  id: string
  title: string
  body: string | null
  category: string
  event_type: string
  urgency: string
  url: string
  meta: Json
  read_at: string | null
  provider_status: string
  accepted_count: number
  failed_count: number
  created_at: string
}

export type NotificationPreferences = {
  user_id: string
  account_enabled: boolean
  category_preferences: Record<string, boolean>
  quiet_hours_enabled: boolean
  quiet_hours_start: string
  quiet_hours_end: string
  quiet_hours_timezone: string
  urgent_bypass: boolean
  muted_entities: string[]
}

export type PushDevice = {
  id: string
  kind: 'webpush' | 'apns'
  deviceId: string | null
  name: string
  platform: string
  enabled: boolean
  syncStatus: string
  failureCount: number
  lastSeenAt: string | null
  lastVerifiedAt: string | null
}

const asBooleanRecord = (value: Json): Record<string, boolean> => {
  if (!value || Array.isArray(value) || typeof value !== 'object') return {}
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  )
}

const asStringArray = (value: Json): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

export async function listNotificationInbox(): Promise<NotificationInboxItem[]> {
  const { data, error } = await dataLayerClient
    .from('notification_inbox')
    .select('id, title, body, category, event_type, urgency, url, meta, read_at, provider_status, accepted_count, failed_count, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await dataLayerClient
    .from('notification_inbox')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await dataLayerClient
    .from('notification_inbox')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  window.dispatchEvent(new Event('notifications_invalidated'))
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await dataLayerClient
    .from('notification_inbox')
    .update({ read_at: new Date().toISOString() })
    .is('read_at', null)
  if (error) throw error
  window.dispatchEvent(new Event('notifications_invalidated'))
}

export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await dataLayerClient
    .from('notification_preferences')
    .select('user_id, account_enabled, category_preferences, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, quiet_hours_timezone, urgent_bypass, muted_entities')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const defaults: NotificationPreferences = {
      user_id: userId,
      account_enabled: true,
      category_preferences: {},
      quiet_hours_enabled: false,
      quiet_hours_start: '22:00:00',
      quiet_hours_end: '07:00:00',
      quiet_hours_timezone: 'Europe/Madrid',
      urgent_bypass: true,
      muted_entities: [],
    }
    const { error: insertError } = await dataLayerClient
      .from('notification_preferences')
      .insert({ ...defaults, category_preferences: defaults.category_preferences, muted_entities: defaults.muted_entities })
    if (insertError) throw insertError
    return defaults
  }
  return {
    ...data,
    category_preferences: asBooleanRecord(data.category_preferences),
    muted_entities: asStringArray(data.muted_entities),
  }
}

export async function updateNotificationPreferences(
  userId: string,
  patch: Partial<Omit<NotificationPreferences, 'user_id'>>,
): Promise<void> {
  const { error } = await dataLayerClient
    .from('notification_preferences')
    .update(patch)
    .eq('user_id', userId)
  if (error) throw error
}

export async function listPushDevices(userId: string): Promise<PushDevice[]> {
  const [web, native] = await Promise.all([
    dataLayerClient
      .from('push_subscriptions')
      .select('id, device_id, device_name, user_agent, enabled, sync_status, failure_count, last_seen_at, last_verified_at')
      .eq('user_id', userId),
    dataLayerClient
      .from('push_device_tokens')
      .select('id, device_id, device_name, platform, enabled, sync_status, failure_count, last_seen_at, last_verified_at')
      .eq('user_id', userId),
  ])
  if (web.error) throw web.error
  if (native.error) throw native.error
  return [
    ...(web.data ?? []).map((row): PushDevice => ({
      id: row.id,
      kind: 'webpush',
      deviceId: row.device_id,
      name: row.device_name || 'Navegador web',
      platform: row.user_agent || 'Web',
      enabled: row.enabled,
      syncStatus: row.sync_status,
      failureCount: row.failure_count,
      lastSeenAt: row.last_seen_at,
      lastVerifiedAt: row.last_verified_at,
    })),
    ...(native.data ?? []).map((row): PushDevice => ({
      id: row.id,
      kind: 'apns',
      deviceId: row.device_id,
      name: row.device_name || 'iPhone',
      platform: row.platform,
      enabled: row.enabled,
      syncStatus: row.sync_status,
      failureCount: row.failure_count,
      lastSeenAt: row.last_seen_at,
      lastVerifiedAt: row.last_verified_at,
    })),
  ]
}

export async function removePushDevice(device: PushDevice): Promise<void> {
  const table = device.kind === 'webpush' ? 'push_subscriptions' : 'push_device_tokens'
  const { error } = await dataLayerClient.from(table).delete().eq('id', device.id)
  if (error) throw error
}
