import { useCallback, useEffect, useState } from 'react'
import { Bell, BellDot } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { getUnreadNotificationCount } from '@/features/notifications/api'
import { useAppBadgeSource } from '@/hooks/useAppBadgeSource'
import { cn } from '@/lib/utils'

interface NotificationBadgeProps {
  userId: string
  userRole: string
  userDepartment: string | null
  display?: 'sidebar' | 'icon'
  className?: string
}
export const NotificationBadge = ({
  userId,
  display = 'sidebar',
  className,
}: NotificationBadgeProps) => {
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    try {
      setUnreadCount(await getUnreadNotificationCount(userId))
    } catch (error) {
      console.error('No se pudo comprobar la bandeja de notificaciones:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    void refresh()
    const intervalId = window.setInterval(() => void refresh(), 30_000)
    const handleInvalidate = () => void refresh()
    window.addEventListener('notifications_invalidated', handleInvalidate)
    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('notifications_invalidated', handleInvalidate)
    }
  }, [refresh])

  useAppBadgeSource('notifications', unreadCount > 0 ? { count: unreadCount } : null)
  const hasUnread = unreadCount > 0
  const readableCount = unreadCount > 99 ? '99+' : String(unreadCount)

  if (display === 'icon') {
    const Icon = hasUnread ? BellDot : Bell
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => navigate('/notifications')}
        disabled={isLoading}
        className={cn('relative h-9 w-9 rounded-full border border-border/60 bg-background/70 text-muted-foreground shadow-sm hover:bg-accent/30 hover:text-foreground', hasUnread && 'text-amber-500', className)}
        aria-label={hasUnread ? `${unreadCount} notificaciones sin leer` : 'Abrir notificaciones'}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {hasUnread && (
          <span aria-hidden="true" className="pointer-events-none absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-[0.7rem] font-semibold text-white shadow">
            {readableCount}
          </span>
        )}
      </Button>
    )
  }

  return (
    <Button type="button" variant="ghost" className={cn('w-full justify-start gap-2', hasUnread && 'text-amber-500', className)} onClick={() => navigate('/notifications')} disabled={isLoading}>
      {hasUnread ? <BellDot className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
      <span>Notificaciones</span>
      {hasUnread && <span className="ml-auto text-xs font-semibold">{readableCount}</span>}
    </Button>
  )
}
