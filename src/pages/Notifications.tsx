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
    <main className="mx-auto w-full max-w-5xl space-y-5 px-3 py-4 pb-24 sm:px-6 md:py-6">
      <div>
        <h1 className="text-2xl font-semibold">Notificaciones</h1>
        <p className="text-sm text-muted-foreground">Consulta tus avisos, elige qué recibir y comprueba tus dispositivos.</p>
      </div>
      <Tabs value={section} onValueChange={(value) => setSearchParams({ section: value }, { replace: true })}>
        <div className="sticky top-0 z-20 -mx-3 overflow-x-auto bg-background/95 px-3 py-2 backdrop-blur sm:mx-0 sm:px-0">
          <TabsList className="h-auto min-w-max" aria-label="Secciones de notificaciones">
            <TabsTrigger value="inbox">Bandeja</TabsTrigger>
            <TabsTrigger value="preferences">Preferencias</TabsTrigger>
            <TabsTrigger value="devices">Dispositivos</TabsTrigger>
            <TabsTrigger value="diagnostics">Diagnóstico</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="inbox"><NotificationInbox /></TabsContent>
        <TabsContent value="preferences"><NotificationPreferencesForm userId={user.id} /></TabsContent>
        <TabsContent value="devices"><PushDevicesPanel userId={user.id} /></TabsContent>
        <TabsContent value="diagnostics"><PushDiagnosticsPanel userId={user.id} /></TabsContent>
      </Tabs>
    </main>
  )
}
