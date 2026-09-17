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
  accepted: 'aceptado',
  partial: 'aceptado parcialmente',
  failed: 'fallido',
  skipped: 'omitido por tus preferencias',
}

function CheckRow({ label, detail, state }: { label: string; detail: string; state: CheckState }) {
  const Icon = state === 'ok' ? CheckCircle2 : state === 'warning' ? CircleAlert : CircleX
  return (
    <li className="flex items-start gap-3 rounded-lg border p-3">
      <Icon className={state === 'ok' ? 'mt-0.5 h-5 w-5 text-emerald-600' : state === 'warning' ? 'mt-0.5 h-5 w-5 text-amber-600' : 'mt-0.5 h-5 w-5 text-destructive'} />
      <div><p className="font-medium">{label}</p><p className="text-sm text-muted-foreground">{detail}</p></div>
    </li>
  )
}

export function PushDiagnosticsPanel({ userId }: { userId: string }) {
  const push = usePushNotifications()
  const currentDeviceId = getPushDeviceId()
  const { data: devices = [] } = useQuery({
    queryKey: queryKeys.scope('push-devices', userId),
    queryFn: () => listPushDevices(userId),
  })
  const { data: inbox = [] } = useQuery({
    queryKey: queryKeys.scope('notification-inbox', 'mine'),
    queryFn: listNotificationInbox,
  })
  const serverDevice = devices.find((device) => device.deviceId === currentDeviceId)
  const latestOutcome = inbox.find((item) => ['accepted', 'partial', 'failed', 'skipped'].includes(item.provider_status))

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
            detail={serverDevice ? `Registrado. Estado: ${syncStatusLabels[serverDevice.syncStatus] ?? 'desconocido'}.` : 'El servidor no reconoce este dispositivo.'}
            state={serverDevice?.syncStatus === 'active' ? 'ok' : serverDevice ? 'warning' : 'error'}
          />
          <CheckRow
            label="Último resultado conocido"
            detail={latestOutcome ? `El proveedor informó: ${providerStatusLabels[latestOutcome.provider_status] ?? 'estado desconocido'}. Aceptados: ${latestOutcome.accepted_count}; fallidos: ${latestOutcome.failed_count}.` : 'Todavía no hay resultados de entrega para mostrar.'}
            state={latestOutcome?.provider_status === 'accepted' ? 'ok' : latestOutcome?.provider_status === 'failed' ? 'error' : 'warning'}
          />
        </ul>
      </CardContent>
    </Card>
  )
}
