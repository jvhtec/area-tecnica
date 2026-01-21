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
import { EquipmentModelsList } from "@/components/equipment/EquipmentModelsList";
import { DepartmentProvider } from "@/contexts/DepartmentContext";
import type { Department } from "@/types/equipment";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Bell, Bug } from "lucide-react";
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDashboardPath } from '@/utils/roleBasedRouting'
import { usePushDebug } from '@/hooks/usePushDebug'
import { PushNotificationMatrix } from '@/components/settings/PushNotificationMatrix'
import { PushNotificationSchedule } from '@/components/settings/PushNotificationSchedule'
import { MorningSummarySubscription } from '@/components/settings/MorningSummarySubscription'
import { ShortcutsSettings } from '@/components/settings/ShortcutsSettings'
import { DryHireFolderManager } from '@/components/settings/DryHireFolderManager'
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
                  className="shrink-0 rounded-md border px-2 py-1 text-xs md:text-sm text-muted-foreground hover:bg-muted flex items-center gap-1"
                  aria-label={open ? "Collapse section" : "Expand section"}
                >
                  <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 transition-transform duration-200 data-[state=open]:rotate-180" />
                  <span className="hidden sm:inline">Toggle</span>
                </button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 md:pb-6 space-y-3 md:space-y-4">
            {children}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

const Settings = () => {
  const navigate = useNavigate();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  // Department selector for Equipment Models card
  const [modelsDepartment, setModelsDepartment] = useState<Department>('sound');

  const { userRole, isLoading: authLoading } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');

  // Early security check: Only allow admin, management
  useEffect(() => {
    if (authLoading) return;

    if (userRole && !['admin', 'management'].includes(userRole)) {
      const redirectPath = getDashboardPath(userRole as any);
      navigate(redirectPath, { replace: true });
    }
  }, [userRole, authLoading, navigate]);
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
      ? 'Granted'
      : permission === 'denied'
        ? 'Blocked'
        : 'Not requested';
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
      const { data, error } = await supabase.functions.invoke('push', {
        body: { action: 'test', url: '/settings' }
      });

      if (error) throw error;

      const result = data as { status: string; results?: Array<{ ok: boolean; skipped?: boolean }> };

      if (result.status === 'sent') {
        const allSkipped = result.results?.every(r => r.skipped);
        if (allSkipped) {
          toast({
            title: "Test notification skipped",
            description: "Push notifications are configured but the server doesn't have VAPID keys set up yet.",
            variant: "destructive"
          });
        } else {
          toast({
            title: "Test notification sent",
            description: "Check your device for the notification!"
          });
        }
      } else {
        toast({
          title: "No subscriptions found",
          description: "Enable push notifications first before testing.",
          variant: "destructive"
        });
      }
    } catch (err) {
      console.error('Test notification error:', err);
      toast({
        title: "Failed to send test",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive"
      });
    }
  };

  const handleBackgroundTest = async () => {
    try {
      toast({
        title: 'Background test scheduled',
        description: 'Press Home now. A test push will be sent in 5 seconds.',
      })
      setTimeout(async () => {
        try {
          const { error } = await supabase.functions.invoke('push', {
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
    'morning-summary': false,
    'shortcuts': false,
    'users': false,
    'company-settings': false,
    'equipment-models': false,
    'dryhire-folders': false,
    'version-info': false,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-full px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4 space-y-3 md:space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <h1 className="text-xl md:text-2xl font-semibold">Settings</h1>
          <div className="flex flex-row gap-2">
            <Button
              onClick={() => setImportUsersOpen(true)}
              variant="outline"
              className="flex-1 sm:flex-initial text-xs sm:text-sm"
              size="sm"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Import Users</span>
              <span className="xs:hidden">Import</span>
            </Button>
            <Button
              onClick={() => setCreateUserOpen(true)}
              className="flex-1 sm:flex-initial text-xs sm:text-sm"
              size="sm"
            >
              <UserPlus className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden xs:inline">Add User</span>
              <span className="xs:hidden">Add</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 md:gap-6 auto-rows-fr">
          <div className="space-y-4 md:space-y-6">
            <CollapsibleCard
              id="push-notifications"
              title="Push notifications"
              description="Get real-time updates about jobs, assignments, and documents directly on your device."
              isOpen={collapsibleStates['push-notifications']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-notifications': open }))}
            >
              {!isSupported ? (
                <Alert variant="info">
                  <AlertTitle>Unsupported browser</AlertTitle>
                  <AlertDescription>
                    Your current browser does not support web push. Try using the latest version of Chrome, Edge, or Safari.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="font-medium">Permission:</span> {permissionLabel}
                    </p>
                    <p>
                      <span className="font-medium">Subscription:</span>{" "}
                      {hasSubscription ? 'Active on this device' : 'Not active yet'}
                    </p>
                  </div>

                  {isInitializing && (
                    <p className="text-sm text-muted-foreground">
                      Checking your device for an existing subscription…
                    </p>
                  )}

                  {error && (
                    <Alert variant="destructive">
                      <AlertTitle>Notification error</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {isBlocked && (
                    <Alert variant="info">
                      <AlertTitle>Notifications blocked</AlertTitle>
                      <AlertDescription>
                        Enable notifications from your browser settings and reload the page to subscribe.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        void enable().catch(() => undefined);
                      }}
                      disabled={!showEnableButton || isEnabling}
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      {isEnabling ? 'Enabling…' : 'Enable'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void disable().catch(() => undefined);
                      }}
                      disabled={!hasSubscription || isDisabling || isInitializing}
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      {isDisabling ? 'Disabling…' : 'Disable'}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleTestNotification}
                      disabled={!hasSubscription || isInitializing}
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      <Bell className="mr-1 h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden xs:inline">Send </span>Test
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={handleBackgroundTest}
                      disabled={!hasSubscription || isInitializing}
                      title="Schedules a test push in 5s so you can background the app"
                      className="w-full text-xs sm:text-sm"
                      size="sm"
                    >
                      BG test (5s)
                    </Button>
                  </div>
                </>
              )}
            </CollapsibleCard>

            {isSupported && (
              <CollapsibleCard
                id="push-diagnostics"
                title="Push diagnostics"
                description="Useful when you can't access Safari's Web Inspector."
                isOpen={collapsibleStates['push-diagnostics']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-diagnostics': open }))}
              >
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Permission:</span> {permissionLabel}</p>
                  <p><span className="font-medium">Has subscription:</span> {hasSubscription ? 'Yes' : 'No'}</p>
                  {subInfo?.endpoint && (
                    <p className="break-words"><span className="font-medium">Endpoint:</span> {String(subInfo.endpoint).slice(0, 64)}…</p>
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
                    <span className="hidden xs:inline">Show </span>Local test
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => setSubInfo(await getSubscriptionInfo())}
                    className="w-full text-xs sm:text-sm"
                    size="sm"
                  >
                    Refresh<span className="hidden xs:inline"> info</span>
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground mt-3">
                  <p className="font-medium mb-1">Recent SW events</p>
                  {events.length === 0 ? (
                    <p>No events yet. Try Send Test or Local SW test.</p>
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
                title="Push notification matrix"
                isOpen={collapsibleStates['push-matrix']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-matrix': open }))}
              >
                <PushNotificationMatrix />
              </CollapsibleCard>
            )}

            {isManagementUser && (
              <CollapsibleCard
                id="push-schedule"
                title="Push notification schedule"
                isOpen={collapsibleStates['push-schedule']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'push-schedule': open }))}
              >
                <PushNotificationSchedule />
              </CollapsibleCard>
            )}

            <CollapsibleCard
              id="shortcuts"
              title="Keyboard shortcuts & Stream Deck"
              description="Manage keyboard shortcuts and Stream Deck button integration"
              isOpen={collapsibleStates['shortcuts']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'shortcuts': open }))}
            >
              <ShortcutsSettings />
            </CollapsibleCard>
          </div>

          <div className="space-y-4 md:space-y-6">
            <CollapsibleCard
              id="morning-summary"
              title="Morning summary"
              isOpen={collapsibleStates['morning-summary']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'morning-summary': open }))}
            >
              <MorningSummarySubscription />
            </CollapsibleCard>

            <CollapsibleCard
              id="users"
              title="Users"
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

            <CollapsibleCard
              id="company-settings"
              title="Company settings"
              isOpen={collapsibleStates['company-settings']}
              onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'company-settings': open }))}
            >
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Company Logo</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your company logo. This will be used in the Memoria Técnica PDFs and other documents.
                </p>
                <CompanyLogoUploader />
              </div>
            </CollapsibleCard>

            {isManagementUser && (
              <CollapsibleCard
                id="equipment-models"
                title="Equipment models"
                isOpen={collapsibleStates['equipment-models']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'equipment-models': open }))}
              >
                <div className="space-y-3 md:space-y-4">
                  <div className="flex flex-col gap-2">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Manage equipment models used in festival forms and gear setup.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs md:text-sm text-muted-foreground whitespace-nowrap">Department:</span>
                      <select
                        className="border rounded px-2 py-1.5 text-xs md:text-sm flex-1 sm:flex-initial sm:min-w-[120px]"
                        value={modelsDepartment}
                        onChange={(e) => setModelsDepartment(e.target.value as Department)}
                      >
                        <option value="sound">Sound</option>
                        <option value="lights">Lights</option>
                        <option value="video">Video</option>
                      </select>
                    </div>
                  </div>
                  <DepartmentProvider department={modelsDepartment}>
                    <EquipmentModelsList />
                  </DepartmentProvider>
                </div>
              </CollapsibleCard>
            )}

            {isManagementUser && (
              <CollapsibleCard
                id="dryhire-folders"
                title="Dry hire folders"
                description="Manage Flex folder structure for dry hire jobs"
                isOpen={collapsibleStates['dryhire-folders']}
                onOpenChange={(open) => setCollapsibleStates(prev => ({ ...prev, 'dryhire-folders': open }))}
              >
                <DryHireFolderManager />
              </CollapsibleCard>
            )}

            {/* Version Display for testing iOS PWA updates */}
            <CollapsibleCard
              id="version-info"
              title="Version info"
              description="Build and service worker version details for testing updates."
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
