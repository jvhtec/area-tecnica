import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { normalizeInternalPath } from '@/lib/internalNavigation'
import { queryKeys } from '@/lib/react-query'
import { categoryLabel, NOTIFICATION_CATEGORIES } from './catalog'
import {
  listNotificationInbox,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationInboxItem,
} from './api'

const inboxKey = queryKeys.scope('notification-inbox', 'mine')

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function deliveryLabel(status: string): string | null {
  switch (status) {
    case 'failed': return 'Push no entregado'
    case 'partial': return 'Entrega parcial'
    case 'pending': return 'Entrega pendiente'
    case 'skipped': return 'Solo en bandeja'
    default: return null
  }
}

export function NotificationInbox() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [view, setView] = useState<'unread' | 'all'>('unread')
  const [category, setCategory] = useState('all')
  const { data = [], isLoading, error } = useQuery({
    queryKey: inboxKey,
    queryFn: listNotificationInbox,
    refetchInterval: 30_000,
  })
  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
  })
  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboxKey }),
    onError: () => toast.error('No se pudieron marcar las notificaciones como leídas.'),
  })

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      const message = event.data as { source?: string; type?: string } | undefined
      if (message?.source !== 'sw') return
      if (message.type === 'notification-shown' || message.type === 'notification-click') {
        void queryClient.invalidateQueries({ queryKey: inboxKey })
      }
    }
    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
  }, [queryClient])

  const items = useMemo(() => data.filter((item) => {
    if (view === 'unread' && item.read_at) return false
    return category === 'all' || item.category === category
  }), [category, data, view])
  const unreadCount = data.filter((item) => !item.read_at).length

  const openItem = (item: NotificationInboxItem) => {
    const target = normalizeInternalPath(item.url)
    if (!target) {
      toast.error('El destino de esta notificación ya no está disponible.')
      return
    }
    // Marking the item as read is best-effort: navigation should not be
    // blocked or reverted by a failed mutation, since the destination is
    // already known to be valid.
    if (!item.read_at) {
      readOne.mutate(item.id, {
        onError: () => toast.error('No se pudo marcar la notificación como leída.'),
      })
    }
    navigate(target)
  }

  if (isLoading) return <p aria-live="polite" className="text-sm text-muted-foreground">Cargando notificaciones…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">No se pudo cargar la bandeja.</p>

  return (
    <div className="space-y-4" aria-busy={readOne.isPending || readAll.isPending}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="overflow-x-auto overscroll-x-contain">
          <Tabs value={view} onValueChange={(value) => setView(value as 'unread' | 'all')}>
            <TabsList className="min-w-max" aria-label="Filtrar notificaciones por estado">
              <TabsTrigger className="min-h-10" value="unread">No leídas ({unreadCount})</TabsTrigger>
              <TabsTrigger className="min-h-10" value="all">Todas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          size="sm"
          onClick={() => readAll.mutate()}
          disabled={unreadCount === 0 || readAll.isPending}
        >
          <CheckCheck className="mr-2 h-4 w-4" />
          Marcar todas como leídas
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1" aria-label="Filtrar por categoría">
        <Button className="min-h-9 shrink-0" size="sm" variant={category === 'all' ? 'default' : 'outline'} onClick={() => setCategory('all')}>Todas</Button>
        {NOTIFICATION_CATEGORIES.map((item) => (
          <Button className="min-h-9 shrink-0" key={item.key} size="sm" variant={category === item.key ? 'default' : 'outline'} onClick={() => setCategory(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
            <Bell className="h-8 w-8" aria-hidden="true" />
            <p>{view === 'unread' ? 'No tienes notificaciones pendientes.' : 'Todavía no hay notificaciones.'}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const providerLabel = deliveryLabel(item.provider_status)
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openItem(item)}
                  className="min-h-14 w-full rounded-lg border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                >
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 font-medium">{item.title}</span>
                      {!item.read_at && <Badge><span className="sr-only">Estado: </span>Nueva</Badge>}
                      {item.urgency === 'urgent' && <Badge variant="destructive">Urgente</Badge>}
                      <Badge variant="outline">{categoryLabel(item.category)}</Badge>
                    </div>
                    {item.body && <p className="line-clamp-3 text-sm text-muted-foreground sm:line-clamp-2">{item.body}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatDate(item.created_at)}</span>
                      {providerLabel && <span>{providerLabel}</span>}
                    </div>
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
