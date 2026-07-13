import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { UserPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { UsersList } from "@/components/users/UsersList";
import { FilterBar } from "@/components/users/filters/FilterBar";
import { ImportUsersDialog } from "@/components/users/import/ImportUsersDialog";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { DEPARTMENT_LABELS } from "@/types/department";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { dataLayerClient } from "@/services/dataLayerClient";
import { toast } from "@/hooks/use-toast";
import { Bell, Bug } from "lucide-react";
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardPath } from '@/utils/roleBasedRouting'
import { isManagementRole } from '@/utils/permissions'
import type { UserRole } from '@/types/user'
import { usePushDebug } from '@/hooks/usePushDebug'
import { PushNotificationMatrix } from '@/components/settings/PushNotificationMatrix'
import { PushNotificationSchedule } from '@/components/settings/PushNotificationSchedule'
import { MorningSummarySubscription } from '@/components/settings/MorningSummarySubscription'
import { ShortcutsSettings } from '@/components/settings/ShortcutsSettings'
import { DryHireFolderManager } from '@/components/settings/DryHireFolderManager'
import { SkillRoleMappingManager } from '@/components/settings/SkillRoleMappingManager'
import { WahaEndpointSettings } from '@/components/settings/WahaEndpointSettings'
import { RealtimeDebugPanel } from '@/components/settings/RealtimeDebugPanel'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown } from "lucide-react"
import { VersionDisplay } from "@/components/VersionDisplay"

// Move CollapsibleCard outside to prevent recreation on every render
const CollapsibleCard = ({
  id,
  title,
  description,
  children,
  defaultOpen = false,
  isOpen,
  onOpenChange,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
  defaultOpen?: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}) => {
  const open = isOpen ?? defaultOpen;
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      className="border rounded-lg"
    >
      <Card className="border-none shadow-none">
        <CardHeader className="pb-3 md:pb-6">
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <CardTitle className="text-base md:text-lg">{title}</CardTitle>
                {description && (
                  <CardDescription className="mt-1.5 text-xs md:text-sm">
                    {description}
                  </CardDescription>
                )}
              </div>
              <CollapsibleTrigger asChild>
                <button
                  className="shrink-0 rounded-md border px-2 py-1 text-xs md:text-sm text-muted-foreground hover:bg-muted flex items-center gap-1 [&[data-state=open]>svg]:rotate-180"
                  aria-label={open ? "Contraer sección" : "Expandir sección"}
                >
                  <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform duration-200" />
                  <span className="hidden sm:inline">Alternar</span>
                </button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 md:pb-6 space-y-3 md:space-y-4 overflow-visible">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

// Equipment departments (sound, lights, video only)

const Settings = () => {
  const navigate = useNavigate();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");


  const { userRole, isLoading: authLoading } = useOptimizedAuth();
  const isManagementUser = isManagementRole(userRole);

  // Early security check: Only allow admin, management
  useEffect(() => {
    if (authLoading) return;

    if (userRole && !isManagementUser) {
      const redirectPath = getDashboardPath(userRole as UserRole);
      navigate(redirectPath, { replace: true });
    }
  }, [userRole, authLoading, isManagementUser, navigate]);
  const {
    isSupported,
    permission,
    subscription,
    isInitializing,
    isEnabling,
    isDisabling,
    error,
    enable,
    disable,
    canEnable
  } = usePushNotifications();

  const permissionLabel =
    permission === 'granted'
      ? 'Concedido'
      : permission === 'denied'
        ? 'Bloqueado'
        : 'No solicitado';
  const hasSubscription = Boolean(subscription);
  const showEnableButton = canEnable && !isInitializing;
  const isBlocked = permission === 'denied';

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedRole("all");
    setSelectedDepartment("all");
  };

  const handleTestNotification = async () => {
    try {
      const { data, error } = await dataLayerClient.functions.invoke('push', {
        body: { action: 'test', url: '/settings' }
      });

      if (error) throw error;

      const result = data as { status: string; results?: Array<{ ok: boolean; skipped?: boolean }> };

      if (result.status === 'sent') {
        const allSkipped = result.results?.every(r => r.skipped);
        if (allSkipped) {
          toast({
            title: "Notificación de prueba omitida",
            description: "Las notificaciones están configuradas, pero el servidor todavía no dispone de claves VAPID.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Notificación de prueba enviada",
            description: "Comprueba la notificación en tu dispositivo."
          });
        }
      } else {
        toast({
          title: "No hay suscripciones",
          description: "Activa primero las notificaciones push para poder probarlas.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Test notification error:', err);
      toast({
        title: "No se pudo enviar la prueba",
        description: err instanceof Error ? err.message : "Error desconocido",
        variant: "destructive"
      });
    }
  };

  const handleBackgroundTest = async () => {
    try {
      toast({
        title: 'Prueba en segundo plano programada',
        description: 'Pulsa Inicio ahora. Se enviará una notificación de prueba en 5 segundos.',
      })
      setTimeout(async () => {
        try {
          const { error } = await dataLayerClient.functions.invoke('push', {
            body: { action: 'test', url: '/settings' },
          })
          if (error) throw error
        } catch (err) {
          console.error('Background test error:', err)
        }
      }, 5000)
    } catch (err) {
      // no-op
    }
  }

  // Debug: surface SW messages and quick local test (helps on iOS without a Mac)
  const { events, showLocalTest, getSubscriptionInfo } = usePushDebug()
  const [subInfo, setSubInfo] = useState<any | null>(null)
  useEffect(() => {
    void (async () => {
      setSubInfo(await getSubscriptionInfo())
    })()
  }, [subscription])

  const [collapsibleStates, setCollapsibleStates] = useState<Record<string, boolean>>({
    'push-notifications': false,
    'push-diagnostics': false,
    'push-matrix': false,
    'push-schedule': false,
    'waha-endpoint': false,
    'realtime-debug': false,
    'morning-summary': false,
    'shortcuts': false,
    'users': false,
    'company-settings': false,
    'dryhire-folders': false,
    'skill-role-mappings': false,
    'version-info': false,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4 space-y-3 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-xl md:text-2xl font-semibold">Ajustes</h1>
          <div className="flex flex-row gap-2">
            <Button
              onClick={() => setImportUsersOpen(true)}
              variant="outline"
              className="flex-1 sm:flex-initial text-xs sm:text-sm"
              size="sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Importar usuarios</span>
              <span className="xs:hidden">Importar</span>
            </Button>
            <Button
              onClick={() => setCreateUserOpen(true)}
              className="flex-1 sm:flex-initial text-xs sm:text-sm"
              size="sm"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Añadir usuario</span>
              <span className="xs:hidden">Añadir</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 items-start">
          <div className="space-y-4 md:space-y-6 w-full min-w-0">
            <CollapsibleCard
              id="push-notifications"
              title="Notificaciones push"
              description="Recibe en tu dispositivo actualizaciones de trabajos, asignaciones y documentos en tiempo real."
              isOpen={collapsibleStates['push-notifications']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-notifications': open }))}
            >
              {!isSupported ? (
                <Alert variant="info">
                  <AlertTitle>Navegador no compatible</AlertTitle>
                  <AlertDescription>
                    Tu navegador no admite notificaciones web push. Prueba la última versión de Chrome, Edge o Safari.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Permiso:</span> {permissionLabel}
                    </p>
                    <p>
                      <span className="font-medium">Suscripción:</span>{" "}
                      {hasSubscription ? 'Activa en este dispositivo' : 'Aún no activa'}
                    </p>
                  </div>

                  {isInitializing && (
                    <p className="text-sm text-muted-foreground">
                      Comprobando si este dispositivo ya tiene una suscripción…
                    </p>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertTitle>Error de notificaciones</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {isBlocked && (
                    <Alert variant="info">
                      <AlertTitle>Notificaciones bloqueadas</AlertTitle>
                      <AlertDescription>
                        Activa las notificaciones en los ajustes del navegador y recarga la página para suscribirte.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        void enable().catch((): undefined => undefined);
                      }}
                      disabled={!showEnableButton || isEnabling}
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      {isEnabling ? 'Activando…' : 'Activar'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void disable().catch((): undefined => undefined);
                      }}
                      disabled={!hasSubscription || isDisabling || isInitializing}
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      {isDisabling ? 'Desactivando…' : 'Desactivar'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleTestNotification}
                      disabled={!hasSubscription || isInitializing}
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      <Bell className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">Enviar </span>prueba
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleBackgroundTest}
                      disabled={!hasSubscription || isInitializing}
                      title="Programa una notificación en 5 segundos para probar la aplicación en segundo plano"
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      Prueba 2.º plano (5 s)
                    </Button>
                  </div>
                </>
              )}
            </CollapsibleCard>

            {isSupported && (
              <CollapsibleCard
                id="push-diagnostics"
                title="Diagnóstico push"
                description="Útil cuando no puedes acceder al inspector web de Safari."
                isOpen={collapsibleStates['push-diagnostics']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-diagnostics': open }))}
              >
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Permiso:</span> {permissionLabel}</p>
                  <p><span className="font-medium">Tiene suscripción:</span> {hasSubscription ? 'Sí' : 'No'}</p>
                  {subInfo?.endpoint && (
                    <p className="break-words"><span className="font-medium">Punto de conexión:</span> {String(subInfo.endpoint).slice(0, 64)}…</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => void showLocalTest()}
                    disabled={permission !== 'granted'}
                    className="w-full text-xs sm:text-sm"
                    size="sm"
                  >
                    <span className="hidden xs:inline">Mostrar </span>prueba local
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => setSubInfo(await getSubscriptionInfo())}
                    className="w-full text-xs sm:text-sm"
                    size="sm"
                  >
                    Actualizar<span className="hidden xs:inline"> información</span>
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-3">
                  <p className="font-medium mb-1">Eventos recientes del service worker</p>
                  {events.length === 0 ? (
                    <p>Aún no hay eventos. Prueba el envío o la prueba local.</p>
                  ) : (
                    <ul className="space-y-1 max-h-40 overflow-auto border rounded p-2 bg-muted/30">
                      {events.slice().reverse().map((e, idx) => (
                        <li key={idx} className="font-mono">
                          {new Date(e.ts).toLocaleTimeString()} — {e.type}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CollapsibleCard>
            )}

            {isManagementUser && (
              <CollapsibleCard
                id="push-matrix"
                title="Matriz de notificaciones push"
                isOpen={collapsibleStates['push-matrix']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-matrix': open }))}
              >
                <PushNotificationMatrix />
              </CollapsibleCard>
            )}

            {isManagementUser && (
              <CollapsibleCard
                id="push-schedule"
                title="Programación de notificaciones push"
                isOpen={collapsibleStates['push-schedule']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-schedule': open }))}
              >
                <PushNotificationSchedule />
              </CollapsibleCard>
            )}

            <CollapsibleCard
              id="shortcuts"
              title="Atajos de teclado y Stream Deck"
              description="Gestiona los atajos de teclado y la integración de botones de Stream Deck"
              isOpen={collapsibleStates['shortcuts']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'shortcuts': open }))}
            >
              <ShortcutsSettings />
            </CollapsibleCard>
          </div>

          <div className="space-y-4 md:space-y-6 w-full min-w-0">
            <CollapsibleCard
              id="morning-summary"
              title="Resumen matinal"
              isOpen={collapsibleStates['morning-summary']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'morning-summary': open }))}
            >
              <MorningSummarySubscription />
            </CollapsibleCard>

            <CollapsibleCard
              id="users"
              title="Usuarios"
              isOpen={collapsibleStates['users']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'users': open }))}
            >
              <FilterBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedRole={selectedRole}
                onRoleChange={setSelectedRole}
                selectedDepartment={selectedDepartment}
                onDepartmentChange={setSelectedDepartment}
                onClearFilters={handleClearFilters}
              />
              <UsersList
                searchQuery={searchQuery}
                roleFilter={selectedRole === "all" ? "" : selectedRole}
                departmentFilter={selectedDepartment === "all" ? "" : selectedDepartment}
                isManagementUser={isManagementUser}
              />
            </CollapsibleCard>

            {isManagementUser && (
              <CollapsibleCard
                id="waha-endpoint"
                title="WAHA de WhatsApp"
                description="Configura el endpoint de WhatsApp asignado a tu cuenta y empareja su sesion WAHA."
                isOpen={collapsibleStates['waha-endpoint']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'waha-endpoint': open }))}
              >
                <WahaEndpointSettings />
              </CollapsibleCard>
            )}

            {isManagementUser && (
              <CollapsibleCard
                id="realtime-debug"
                title="Diagnósticos en tiempo real"
                description="Inspeccionar suscripciones pertenecientes a rutas, rutas propietarias, actividad de payload y contadores de recarga."
                isOpen={collapsibleStates['realtime-debug']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'realtime-debug': open }))}
              >
                <RealtimeDebugPanel />
              </CollapsibleCard>
            )}

            <CollapsibleCard
              id="company-settings"
              title="Ajustes de empresa"
              isOpen={collapsibleStates['company-settings']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'company-settings': open }))}
            >
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Logotipo de la empresa</h3>
                <p className="text-sm text-muted-foreground">
                  Sube el logotipo de la empresa. Se usará en los PDF de memoria técnica y otros documentos.
                </p>
                <CompanyLogoUploader />
              </div>
            </CollapsibleCard>



            {isManagementUser && (
              <CollapsibleCard
                id="skill-role-mappings"
                title="Catalogo de habilidades y mapeos de rol"
                description="Gestiona habilidades de staffing y como influyen en las recomendaciones por prefijo de rol."
                isOpen={collapsibleStates['skill-role-mappings']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'skill-role-mappings': open }))}
              >
                <SkillRoleMappingManager />
              </CollapsibleCard>
            )}

            {isManagementUser && (
              <CollapsibleCard
                id="dryhire-folders"
                title="Carpetas de dry hire"
                description="Gestiona la estructura de carpetas de Flex para trabajos de dry hire"
                isOpen={collapsibleStates['dryhire-folders']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'dryhire-folders': open }))}
              >
                <DryHireFolderManager />
              </CollapsibleCard>
            )}

            {/* Version Display for testing iOS PWA updates */}
            <CollapsibleCard
              id="version-info"
              title="Información de versión"
              description="Detalles de la compilación y del service worker para comprobar actualizaciones."
              isOpen={collapsibleStates['version-info']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'version-info': open }))}
            >
              <VersionDisplay />
            </CollapsibleCard>
          </div>
        </div>
        <CreateUserDialog
          open={createUserOpen}
          onOpenChange={setCreateUserOpen}
        />

        <ImportUsersDialog
          open={importUsersOpen}
          onOpenChange={setImportUsersOpen}
        />
      </div>
    </div>
  );
};

export default Settings;
