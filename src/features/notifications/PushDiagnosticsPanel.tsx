import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, CircleAlert, CircleX } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { getPushDeviceId } from '@/lib/pushDevice'
import { queryKeys } from '@/lib/react-query'
import { listNotificationInbox, listPushDevices } from './api'

type CheckState = 'ok' | 'warning' | 'error'

const syncStatusLabels: Record<string, string> = {
  active: 'activo',
  stale: 'sin actividad reciente',
  failing: 'con fallos',
  disabled: 'desactivado',
}

const providerStatusLabels: Record<string, string> = {
  pending: 'pendiente',
  accepted: 'aceptado',
  partial: 'aceptado parcialmente',
  failed: 'fallido',
  skipped: 'no enviado por push',
}

function CheckRow({ label, detail, state }: { label: string; detail: string; state: CheckState }) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warning' ? CircleAlert : CircleX
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
      <Icon className={state === 'ok' ? 'mt-0.5 h-5 w-5 shrink-0 text-emerald-600' : state === 'warning' ? 'mt-0.5 h-5 w-5 shrink-0 text-amber-600' : 'mt-0.5 h-5 w-5 shrink-0 text-destructive'} />
      <div className="min-w-0"><p className="font-medium">{label}</p><p className="break-words text-sm text-muted-foreground">{detail}</p></div>
    </li>
  )
}

export function PushDiagnosticsPanel({ userId }: { userId: string }) {
  const push = usePushNotifications()
  const currentDeviceId = getPushDeviceId()
  const { data: devices = [], isLoading: devicesLoading, error: devicesError } = useQuery({
    queryKey: queryKeys.scope('push-devices', userId),
    queryFn: () => listPushDevices(userId),
  })
  const { data: inbox = [], isLoading: inboxLoading, error: inboxError } = useQuery({
    queryKey: queryKeys.scope('notification-inbox', 'mine'),
    queryFn: listNotificationInbox,
  })
  const serverDevice = devices.find((device) => device.deviceId === currentDeviceId)
  const latestOutcome = inbox[0]

  const serverDetail = devicesLoading
    ? 'Comprobando el registro del servidor…'
    : devicesError
      ? 'No se pudo consultar el registro del servidor.'
      : serverDevice
        ? `Registrado. Estado: ${syncStatusLabels[serverDevice.syncStatus] ?? 'desconocido'}.`
        : 'El servidor no reconoce este dispositivo.'
  const serverState: CheckState = devicesLoading
    ? 'warning'
    : devicesError
      ? 'error'
      : serverDevice?.syncStatus === 'active'
        ? 'ok'
        : serverDevice
          ? 'warning'
          : 'error'

  const latestDetail = inboxLoading
    ? 'Comprobando el último resultado…'
    : inboxError
      ? 'No se pudo consultar el historial de entrega.'
      : latestOutcome
        ? `Estado: ${providerStatusLabels[latestOutcome.provider_status] ?? 'desconocido'}. Aceptados: ${latestOutcome.accepted_count}; fallidos: ${latestOutcome.failed_count}.`
        : 'Todavía no hay resultados de entrega para mostrar.'
  const latestState: CheckState = inboxLoading
    ? 'warning'
    : inboxError
      ? 'error'
      : latestOutcome?.provider_status === 'accepted'
        ? 'ok'
        : latestOutcome?.provider_status === 'failed'
          ? 'error'
          : 'warning'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comprobar notificaciones</CardTitle>
        <CardDescription>La aceptación del proveedor confirma que recibió el aviso; no permite saber si el sistema lo mostró o si lo abriste.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          <CheckRow
            label="Compatibilidad"
            detail={push.isSupported ? 'Este dispositivo admite notificaciones push.' : 'Este dispositivo no ofrece la tecnología necesaria.'}
            state={push.isSupported ? 'ok' : 'error'}
          />
          <CheckRow
            label="Permiso"
            detail={push.permission === 'granted' ? 'Permiso concedido.' : push.permission === 'denied' ? 'Bloqueado en los ajustes del navegador o sistema.' : 'Todavía no has concedido permiso.'}
            state={push.permission === 'granted' ? 'ok' : push.permission === 'denied' ? 'error' : 'warning'}
          />
          <CheckRow
            label="Registro local"
            detail={push.subscription ? 'Existe un registro en este dispositivo.' : 'No existe un registro local.'}
            state={push.subscription ? 'ok' : 'warning'}
          />
          <CheckRow
            label="Sincronización con el servidor"
            detail={serverDetail}
            state={serverState}
          />
          <CheckRow
            label="Último resultado conocido"
            detail={latestDetail}
            state={latestState}
          />
        </ul>
      </CardContent>
    </Card>
  )
}
