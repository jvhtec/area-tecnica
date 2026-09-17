import { useSearchParams } from 'react-router-dom'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NotificationInbox } from '@/features/notifications/NotificationInbox'
import { NotificationPreferencesForm } from '@/features/notifications/NotificationPreferencesForm'
import { PushDevicesPanel } from '@/features/notifications/PushDevicesPanel'
import { PushDiagnosticsPanel } from '@/features/notifications/PushDiagnosticsPanel'
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth'

const SECTIONS = new Set(['inbox', 'preferences', 'devices', 'diagnostics'])

export default function Notifications() {
  const { user } = useOptimizedAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('section') || 'inbox'
  const section = SECTIONS.has(requested) ? requested : 'inbox'

  if (!user) return null

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5" aria-labelledby="notifications-title">
      <div className="space-y-1">
        <h1 id="notifications-title" className="text-2xl font-semibold tracking-tight">Notificaciones</h1>
        <p className="text-sm text-muted-foreground">Consulta tus avisos, elige qué recibir y comprueba tus dispositivos.</p>
      </div>
      <Tabs value={section} onValueChange={(value) => setSearchParams({ section: value }, { replace: true })}>
        <div className="sticky top-0 z-20 -mx-3 overflow-x-auto overscroll-x-contain bg-background/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
          <TabsList className="h-auto min-w-max gap-1 p-1" aria-label="Secciones de notificaciones">
            <TabsTrigger className="min-h-10 px-3" value="inbox">Bandeja</TabsTrigger>
            <TabsTrigger className="min-h-10 px-3" value="preferences">Preferencias</TabsTrigger>
            <TabsTrigger className="min-h-10 px-3" value="devices">Dispositivos</TabsTrigger>
            <TabsTrigger className="min-h-10 px-3" value="diagnostics">Diagnóstico</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent className="mt-4" value="inbox"><NotificationInbox /></TabsContent>
        <TabsContent className="mt-4" value="preferences"><NotificationPreferencesForm userId={user.id} /></TabsContent>
        <TabsContent className="mt-4" value="devices"><PushDevicesPanel userId={user.id} /></TabsContent>
        <TabsContent className="mt-4" value="diagnostics"><PushDiagnosticsPanel userId={user.id} /></TabsContent>
      </Tabs>
    </section>
  )
}
