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
  const [isDirty, setIsDirty] = useState(false)
  const save = useMutation({
    mutationFn: async (nextDraft: NotificationPreferences) => {
      const { user_id: _userId, ...patch } = nextDraft
      await updateNotificationPreferences(userId, patch)
      return nextDraft
    },
    onSuccess: async (savedDraft) => {
      await queryClient.invalidateQueries({ queryKey })
      const refreshed = queryClient.getQueryData<NotificationPreferences>(queryKey)
      setDraft(refreshed ?? savedDraft)
      setIsDirty(false)
      toast.success('Preferencias guardadas')
    },
    onError: () => toast.error('No se pudieron guardar las preferencias'),
  })

  // Background refetches (window focus, another panel invalidating queries, etc.)
  // must never erase an unsaved local edit. Once a save completes we explicitly
  // replace the draft with the refreshed server snapshot above.
  useEffect(() => {
    if (!isDirty && !save.isPending) setDraft(data ?? null)
  }, [data, isDirty, save.isPending])

  if (error) return <p role="alert" className="text-sm text-destructive">No se pudieron cargar las preferencias.</p>
  if (isLoading || !draft) return <p className="text-sm text-muted-foreground">Cargando preferencias…</p>

  const categoryEnabled = (key: string) => draft.category_preferences[key] !== false
  const controlsDisabled = save.isPending
  const updateDraft = (next: NotificationPreferences) => {
    setDraft(next)
    setIsDirty(true)
  }

  return (
    <div className="space-y-4" aria-busy={controlsDisabled}>
      <Card>
        <CardHeader>
          <CardTitle>Entrega en la cuenta</CardTitle>
          <CardDescription>Este ajuste se aplica a todos tus dispositivos. Cada dispositivo se activa o desactiva por separado.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <Label className="min-w-0 flex-1" htmlFor="notifications-account-enabled">Recibir notificaciones push</Label>
            <Switch
              className="shrink-0"
              id="notifications-account-enabled"
              checked={draft.account_enabled}
              disabled={controlsDisabled}
              onCheckedChange={(checked) => updateDraft({ ...draft, account_enabled: checked })}
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
              <Label className="min-w-0 flex-1" htmlFor={`notification-category-${item.key}`}>{item.label}</Label>
              <Switch
                className="shrink-0"
                id={`notification-category-${item.key}`}
                checked={categoryEnabled(item.key)}
                disabled={controlsDisabled}
                onCheckedChange={(checked) => updateDraft({
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
            <Label className="min-w-0 flex-1" htmlFor="quiet-hours-enabled">Activar horas de silencio</Label>
            <Switch
              className="shrink-0"
              id="quiet-hours-enabled"
              checked={draft.quiet_hours_enabled}
              disabled={controlsDisabled}
              onCheckedChange={(checked) => updateDraft({ ...draft, quiet_hours_enabled: checked })}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-start">Desde</Label>
              <Input id="quiet-hours-start" type="time" disabled={controlsDisabled} value={draft.quiet_hours_start.slice(0, 5)} onChange={(event) => updateDraft({ ...draft, quiet_hours_start: `${event.target.value}:00` })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiet-hours-end">Hasta</Label>
              <Input id="quiet-hours-end" type="time" disabled={controlsDisabled} value={draft.quiet_hours_end.slice(0, 5)} onChange={(event) => updateDraft({ ...draft, quiet_hours_end: `${event.target.value}:00` })} />
            </div>
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label className="min-w-0 flex-1" htmlFor="urgent-bypass">Permitir avisos urgentes durante el silencio</Label>
            <Switch className="shrink-0" id="urgent-bypass" checked={draft.urgent_bypass} disabled={controlsDisabled} onCheckedChange={(checked) => updateDraft({ ...draft, urgent_bypass: checked })} />
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
              <div key={entity} className="flex flex-col gap-2 rounded border p-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0 truncate text-sm">{entity}</span>
                <Button className="w-full sm:w-auto" variant="ghost" size="sm" disabled={controlsDisabled} onClick={() => updateDraft({ ...draft, muted_entities: draft.muted_entities.filter((item) => item !== entity) })}>Quitar silencio</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button onClick={() => save.mutate(draft)} disabled={save.isPending || !isDirty} className="w-full sm:w-auto">
          {save.isPending ? 'Guardando…' : isDirty ? 'Guardar preferencias' : 'Preferencias guardadas'}
        </Button>
        {isDirty && !save.isPending && <p className="text-xs text-muted-foreground">Hay cambios sin guardar.</p>}
      </div>
    </div>
  )
}
