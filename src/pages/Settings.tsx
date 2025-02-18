
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserPlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CreateUserDialog } from "@/components/users/CreateUserDialog";
import { UsersList } from "@/components/users/UsersList";
import { useState } from "react";
import { FilterBar } from "@/components/users/filters/FilterBar";
import { ImportUsersDialog } from "@/components/users/import/ImportUsersDialog";
import { FestivalLogoManager } from "@/components/festival/FestivalLogoManager";

const Settings = () => {
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
              <CardTitle>Company Assets</CardTitle>
            </CardHeader>
            <CardContent>
              <FestivalLogoManager jobId="default" />
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
              />
            </CardContent>
          </Card>
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
