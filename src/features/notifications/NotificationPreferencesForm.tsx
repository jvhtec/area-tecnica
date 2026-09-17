import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { queryKeys } from '@/lib/react-query'
import { NOTIFICATION_CATEGORIES } from './catalog'
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from './api'

export function NotificationPreferencesForm({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.scope('notification-preferences', userId)
  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => getNotificationPreferences(userId),
  })
  const [draft, setDraft] = useState<NotificationPreferences | null>(null)
  useEffect(() => setDraft(data ?? null), [data])
  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return
      const { user_id: _userId, ...patch } = draft
      await updateNotificationPreferences(userId, patch)
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success('Preferencias guardadas')
    },
    onError: () => toast.error('No se pudieron guardar las preferencias'),
  })

  if (error) return <p role="alert" className="text-sm text-destructive">No se pudieron cargar las preferencias.</p>
  if (isLoading || !draft) return <p className="text-sm text-muted-foreground">Cargando preferencias…</p>

  const categoryEnabled = (key: string) => draft.category_preferences[key] !== false
  // The success handler awaits invalidateQueries before isPending flips back
  // to false, so disabling every control for that whole window prevents an
  // edit made during the refetch from being silently replaced by useEffect
  // when the server snapshot lands.
  const controlsDisabled = save.isPending

  return (
    <div className="space-y-4" aria-busy={controlsDisabled}>
      <Card>
        <CardHeader>
          <CardTitle>Entrega en la cuenta</CardTitle>
          <CardDescription>Este ajuste se aplica a todos tus dispositivos. Cada dispositivo se activa o desactiva por separado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="notifications-account-enabled">Recibir notificaciones push</Label>
            <Switch
              id="notifications-account-enabled"
              checked={draft.account_enabled}
              disabled={controlsDisabled}
              onCheckedChange={(checked) => setDraft({ ...draft, account_enabled: checked })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>Los avisos desactivados siguen disponibles en tu bandeja.</CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {NOTIFICATION_CATEGORIES.map((item) => (
            <div key={item.key} className="flex min-h-12 items-center justify-between gap-4 py-2">
              <Label htmlFor={`notification-category-${item.key}`}>{item.label}</Label>
              <Switch
                id={`notification-category-${item.key}`}
                checked={categoryEnabled(item.key)}
                disabled={controlsDisabled}
                onCheckedChange={(checked) => setDraft({
                  ...draft,
                  category_preferences: { ...draft.category_preferences, [item.key]: checked },
                })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Horas de silencio</CardTitle>
          <CardDescription>Usamos la zona horaria Europe/Madrid. Los avisos se guardan en la bandeja durante este intervalo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="quiet-hours-enabled">Activar horas de silencio</Label>
            <Switch
              id="quiet-hours-enabled"
              checked={draft.quiet_hours_enabled}
              disabled={controlsDisabled}
              onCheckedChange={(checked) => setDraft({ ...draft, quiet_hours_enabled: checked })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-start">Desde</Label>
              <Input id="quiet-hours-start" type="time" disabled={controlsDisabled} value={draft.quiet_hours_start.slice(0, 5)} onChange={(event) => setDraft({ ...draft, quiet_hours_start: `${event.target.value}:00` })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-end">Hasta</Label>
              <Input id="quiet-hours-end" type="time" disabled={controlsDisabled} value={draft.quiet_hours_end.slice(0, 5)} onChange={(event) => setDraft({ ...draft, quiet_hours_end: `${event.target.value}:00` })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="urgent-bypass">Permitir avisos urgentes durante el silencio</Label>
            <Switch id="urgent-bypass" checked={draft.urgent_bypass} disabled={controlsDisabled} onCheckedChange={(checked) => setDraft({ ...draft, urgent_bypass: checked })} />
          </div>
          <Alert>
            <AlertTitle>Avisos urgentes</AlertTitle>
            <AlertDescription>Incluyen cancelaciones, retirada de asignaciones, incidencias y partes rechazados.</AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {draft.muted_entities.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Elementos silenciados</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {draft.muted_entities.map((entity) => (
              <div key={entity} className="flex items-center justify-between gap-3 rounded border p-2">
                <span className="truncate text-sm">{entity}</span>
                <Button variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => setDraft({ ...draft, muted_entities: draft.muted_entities.filter((item) => item !== entity) })}>Quitar silencio</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full sm:w-auto">
        {save.isPending ? 'Guardando…' : 'Guardar preferencias'}
      </Button>
    </div>
  )
}
