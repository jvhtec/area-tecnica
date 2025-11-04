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
import { usePushDebug } from '@/hooks/usePushDebug'
import { PushNotificationMatrix } from '@/components/settings/PushNotificationMatrix'

const Settings = () => {
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  // Department selector for Equipment Models card
  const [modelsDepartment, setModelsDepartment] = useState<Department>('sound');
  
  const { userRole } = useOptimizedAuth();
  const isManagementUser = ['admin', 'management'].includes(userRole || '');
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:justify-between md:items-center">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={() => setImportUsersOpen(true)} variant="outline" className="w-full sm:w-auto">
            <Upload className="mr-2 h-4 w-4" />
            Import Users
          </Button>
          <Button onClick={() => setCreateUserOpen(true)} className="w-full sm:w-auto">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 md:gap-6">
        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Push notifications</CardTitle>
              <CardDescription>
                Get real-time updates about jobs, assignments, and documents directly on
                your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!isSupported ? (
                <Alert variant="info">
                  <AlertTitle>Unsupported browser</AlertTitle>
                  <AlertDescription>
                    Your current browser does not support web push. Try using the latest
                    version of Chrome, Edge, or Safari.
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
                        Enable notifications from your browser settings and reload the page to
                        subscribe.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        void enable().catch(() => undefined);
                      }}
                      disabled={!showEnableButton || isEnabling}
                      className="w-full"
                    >
                      {isEnabling ? 'Enabling…' : 'Enable push'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void disable().catch(() => undefined);
                      }}
                      disabled={!hasSubscription || isDisabling || isInitializing}
                      className="w-full"
                    >
                      {isDisabling ? 'Disabling…' : 'Disable push'}
                    </Button>
                  <Button
                    variant="secondary"
                    onClick={handleTestNotification}
                    disabled={!hasSubscription || isInitializing}
                    className="w-full"
                  >
                    <Bell className="mr-2 h-4 w-4" />
                    Send Test
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleBackgroundTest}
                    disabled={!hasSubscription || isInitializing}
                    title="Schedules a test push in 5s so you can background the app"
                    className="w-full"
                  >
                    Background test (5s)
                  </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {isSupported && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bug className="h-4 w-4" /> Push diagnostics</CardTitle>
                <CardDescription>Useful when you can’t access Safari’s Web Inspector.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-1">
                  <p><span className="font-medium">Permission:</span> {permissionLabel}</p>
                  <p><span className="font-medium">Has subscription:</span> {hasSubscription ? 'Yes' : 'No'}</p>
                  {subInfo?.endpoint && (
                    <p className="break-words"><span className="font-medium">Endpoint:</span> {String(subInfo.endpoint).slice(0, 64)}…</p>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="secondary" onClick={() => void showLocalTest()} disabled={permission !== 'granted'} className="w-full sm:w-auto">
                    Show local SW test
                  </Button>
                  <Button variant="outline" onClick={async () => setSubInfo(await getSubscriptionInfo())} className="w-full sm:w-auto">
                    Refresh subscription info
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground">
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
              </CardContent>
            </Card>
          )}

          {isManagementUser && (
            <PushNotificationMatrix />
          )}

          <Card>
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 md:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Company Logo</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your company logo. This will be used in the Memoria Técnica PDFs and other documents.
                </p>
                <CompanyLogoUploader />
              </div>
            </CardContent>
          </Card>
          
          {isManagementUser && (
            <Card>
              <CardHeader>
                <CardTitle>Equipment Models</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      Manage equipment models used in festival forms and gear setup.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Department</span>
                      <select
                        className="border rounded px-3 py-2 text-sm min-w-[120px]"
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
              </CardContent>
            </Card>
          )}
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
  );
};

export default Settings;
