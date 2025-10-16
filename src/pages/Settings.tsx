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
import { useState } from "react";
import { FilterBar } from "@/components/users/filters/FilterBar";
import { ImportUsersDialog } from "@/components/users/import/ImportUsersDialog";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { EquipmentModelsList } from "@/components/equipment/EquipmentModelsList";
import { DepartmentProvider } from "@/contexts/DepartmentContext";
import type { Department } from "@/types/equipment";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePushNotifications } from "@/hooks/usePushNotifications";

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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="flex gap-2">
          <Button onClick={() => setImportUsersOpen(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Users
          </Button>
          <Button onClick={() => setCreateUserOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-6">
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

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        void enable().catch(() => undefined);
                      }}
                      disabled={!showEnableButton || isEnabling}
                    >
                      {isEnabling ? 'Enabling…' : 'Enable push'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void disable().catch(() => undefined);
                      }}
                      disabled={!hasSubscription || isDisabling || isInitializing}
                    >
                      {isDisabling ? 'Disabling…' : 'Disable push'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

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

        <div className="space-y-6">
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
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Manage equipment models used in festival forms and gear setup.
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Department</span>
                      <select
                        className="border rounded px-2 py-1 text-sm"
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
