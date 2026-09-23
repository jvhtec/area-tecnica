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
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardPath } from '@/utils/roleBasedRouting'
import { isManagementRole } from '@/utils/permissions'
import type { UserRole } from '@/types/user'
import { PushNotificationMatrix } from '@/components/settings/PushNotificationMatrix'
import { PushNotificationSchedule, ShiftReminderSchedule } from '@/components/settings/PushNotificationSchedule'
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
                  aria-label={`${open ? "Contraer" : "Expandir"} sección: ${title}`}
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
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedRole("all");
    setSelectedDepartment("all");
  };

  const [collapsibleStates, setCollapsibleStates] = useState<Record<string, boolean>>({
    'push-notifications': false,
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
              title="Centro de notificaciones"
              description="Gestiona tu bandeja, preferencias, dispositivos y diagnóstico desde un único lugar."
              isOpen={collapsibleStates['push-notifications']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-notifications': open }))}
            >
              <Button onClick={() => navigate('/notifications?section=devices')}>
                Abrir centro de notificaciones
              </Button>
            </CollapsibleCard>

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
                <div className="space-y-4">
                  <PushNotificationSchedule />
                  <ShiftReminderSchedule />
                </div>
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
