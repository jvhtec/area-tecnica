
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Upload, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { UsersList } from "@/components/users/UsersList";
import { useState } from "react";
import { FilterBar } from "@/components/users/filters/FilterBar";
import { ImportUsersDialog } from "@/components/users/import/ImportUsersDialog";
import { CompanyLogoUploader } from "@/components/CompanyLogoUploader";
import { EquipmentModelsList } from "@/components/equipment-models/EquipmentModelsList";
import { useAuth } from "@/hooks/useAuth";

const Settings = () => {
  const { user } = useAuth();
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [importUsersOpen, setImportUsersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedRole("all");
    setSelectedDepartment("all");
  };

  // Check if user has management permissions
  const isManagement = user?.user_metadata?.role === 'admin' || user?.user_metadata?.role === 'management';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Settings</h1>
        {isManagement && (
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
        )}
      </div>

      <div className="grid gap-6">
        {isManagement && (
          <div className="grid md:grid-cols-2 gap-6">
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
                />
              </CardContent>
            </Card>

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
          </div>
        )}

        {isManagement && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5" />
                Equipment Models Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-6">
                Manage the available equipment models for FOH/Monitor consoles, wireless systems, and IEM systems.
                These models will be available in festival gear forms and artist forms.
              </p>
              <EquipmentModelsList />
            </CardContent>
          </Card>
        )}

        {!isManagement && (
          <Card>
            <CardHeader>
              <CardTitle>User Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Contact your administrator to manage users and equipment models.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {isManagement && (
        <>
          <CreateUserDialog 
            open={createUserOpen} 
            onOpenChange={setCreateUserOpen} 
          />
          
          <ImportUsersDialog
            open={importUsersOpen}
            onOpenChange={setImportUsersOpen}
          />
        </>
      )}
    </div>
  );
};

export default Settings;
