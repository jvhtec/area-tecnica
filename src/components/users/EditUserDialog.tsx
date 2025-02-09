
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Profile } from "./types";
import { Department } from "@/types/department";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface EditUserDialogProps {
  user: Profile | null;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedData: Partial<Profile>) => void;
}

export const EditUserDialog = ({ user, onOpenChange, onSave }: EditUserDialogProps) => {
  if (!user?.id) {
    console.error("EditUserDialog: No valid user ID provided");
    return null;
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Ensure we have a valid user ID
    if (!user.id) {
      console.error("Cannot update user: No valid ID");
      return;
    }

    const updatedData: Partial<Profile> = {
      id: user.id,
      first_name: formData.get('firstName') as string,
      last_name: formData.get('lastName') as string,
      phone: formData.get('phone') as string,
      department: formData.get('department') as Department,
      dni: formData.get('dni') as string,
      residencia: formData.get('residencia') as string,
      role: formData.get('role') as string,
    };

    console.log("Submitting user update with data:", updatedData);
    onSave(updatedData);
  };

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User Profile</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              defaultValue={user.first_name || ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              defaultValue={user.last_name || ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              defaultValue={user.phone || ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">Department</Label>
            <Select name="department" defaultValue={user.department || 'sound'}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sound">Sound</SelectItem>
                <SelectItem value="lights">Lights</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="logistics">Logistics</SelectItem>
                <SelectItem value="administrative">Administrative</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select name="role" defaultValue={user.role}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="management">Management</SelectItem>
                <SelectItem value="logistics">Logistics</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dni">DNI/NIE</Label>
            <Input
              id="dni"
              name="dni"
              defaultValue={user.dni || ''}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="residencia">Residencia</Label>
            <Input
              id="residencia"
              name="residencia"
              defaultValue={user.residencia || ''}
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};