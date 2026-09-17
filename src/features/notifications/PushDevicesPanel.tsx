import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleAlert, Smartphone, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { getPushDeviceId } from '@/lib/pushDevice'
import { queryKeys } from '@/lib/react-query'
import { dataLayerClient } from '@/services/dataLayerClient'
import { listPushDevices, removePushDevice, type PushDevice } from './api'

const statusLabel = (device: PushDevice): string => {
  if (!device.enabled || device.syncStatus === 'disabled') return 'Desactivado'
  if (device.failureCount > 0 || device.syncStatus === 'failing') return 'Con fallos'
  if (device.syncStatus === 'stale') return 'Sin actividad reciente'
  return 'Registrado'
}

const formatLastSeen = (value: string | null): string => value
  ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Sin verificación registrada'

export function PushDevicesPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const queryKey = queryKeys.scope('push-devices', userId)
  const currentDeviceId = getPushDeviceId()
  const push = usePushNotifications()
  const [isDeviceActionPending, setIsDeviceActionPending] = useState(false)
  const [isTestPending, setIsTestPending] = useState(false)
  const { data = [], isLoading, error } = useQuery({ queryKey, queryFn: () => listPushDevices(userId) })
  const remove = useMutation({
    mutationFn: removePushDevice,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey })
      toast.success('Dispositivo eliminado')
    },
    onError: () => toast.error('No se pudo eliminar el dispositivo'),
  })
  const currentServerDevice = data.find((device) => device.deviceId === currentDeviceId)
  const currentStatus = !push.isSupported
    ? 'No compatible'
    : push.permission === 'denied'
      ? 'Bloqueado'
      : push.isInitializing
        ? 'Comprobando…'
        : push.subscription && currentServerDevice
          ? 'Activo'
          : push.subscription
            ? 'Necesita sincronización'
            : 'Sin configurar'

  const toggleCurrent = async () => {
    if (isDeviceActionPending) return
    setIsDeviceActionPending(true)
    try {
      const wasEnabled = Boolean(push.subscription && currentServerDevice)
      const neededSynchronization = Boolean(push.subscription && !currentServerDevice)
      if (neededSynchronization) await push.synchronize()
      else if (push.subscription) await push.disable()
      else await push.enable()
      await queryClient.invalidateQueries({ queryKey })
      toast.success(
        neededSynchronization
          ? 'Dispositivo sincronizado'
          : wasEnabled
            ? 'Notificaciones desactivadas en este dispositivo'
            : 'Dispositivo activado',
      )
    } catch {
      toast.error('No se pudo actualizar este dispositivo')
    } finally {
      setIsDeviceActionPending(false)
    }
  }

  const sendTest = async () => {
    if (isTestPending) return
    setIsTestPending(true)
    try {
      const { data: result, error: testError } = await dataLayerClient.functions.invoke('push', {
        body: { action: 'test', device_id: currentDeviceId, url: '/notifications?section=diagnostics' },
      })
      if (testError) throw testError
      const status = (result as { status?: string })?.status
      if (status === 'accepted' || status === 'partial') {
        toast.success('Prueba aceptada por el servicio push')
        return
      }
      toast.error('El servicio push no aceptó la prueba')
    } catch {
      toast.error('No se pudo enviar la prueba')
    } finally {
      setIsTestPending(false)
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Comprobando dispositivos…</p>
  if (error) return <p role="alert" className="text-sm text-destructive">No se pudieron cargar los dispositivos.</p>

  const controlsBusy = push.isInitializing || push.isEnabling || push.isDisabling || isDeviceActionPending

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 shrink-0" />Este dispositivo</CardTitle>
          <CardDescription>Activarlo o desactivarlo no cambia tus preferencias de cuenta ni otros dispositivos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {currentStatus === 'Activo' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <CircleAlert className="h-5 w-5 shrink-0 text-amber-600" />}
            <span className="font-medium">{currentStatus}</span>
          </div>
          {push.error && <p role="alert" className="text-sm text-destructive">{push.error}</p>}
          {push.permission === 'denied' && (
            <p className="text-sm text-muted-foreground">Permite las notificaciones en los ajustes del navegador o del sistema y vuelve a abrir esta página.</p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="w-full sm:w-auto" onClick={() => void toggleCurrent()} disabled={!push.isSupported || controlsBusy || push.permission === 'denied'}>
              {isDeviceActionPending
                ? 'Actualizando…'
                : currentStatus === 'Necesita sincronización'
                  ? 'Sincronizar'
                  : push.subscription
                    ? 'Desactivar en este dispositivo'
                    : 'Activar en este dispositivo'}
            </Button>
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => void sendTest()} disabled={!push.subscription || !currentServerDevice || isTestPending || controlsBusy}>
              {isTestPending ? 'Enviando prueba…' : 'Enviar prueba a este dispositivo'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dispositivos registrados</CardTitle>
          <CardDescription>Un registro indica que el servidor conoce el dispositivo; no confirma que el aviso se haya mostrado.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay dispositivos registrados.</p>
          ) : (
            <ul className="space-y-2">
              {data.map((device) => (
                <li key={`${device.kind}-${device.id}`} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 break-words font-medium">{device.name}</span>
                      {device.deviceId === currentDeviceId && <Badge>Este dispositivo</Badge>}
                      <Badge variant="outline">{statusLabel(device)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">Última verificación: {formatLastSeen(device.lastVerifiedAt || device.lastSeenAt)}</p>
                  </div>
                  {device.deviceId !== currentDeviceId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button className="h-10 w-full shrink-0 sm:w-10" variant="ghost" size="icon" aria-label={`Eliminar ${device.name}`}><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar este dispositivo?</AlertDialogTitle>
                          <AlertDialogDescription>Dejará de recibir avisos push. Podrás registrarlo de nuevo desde ese dispositivo.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(device)}>Eliminar</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
