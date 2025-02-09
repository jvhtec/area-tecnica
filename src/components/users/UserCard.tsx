import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Profile } from "./types";

interface UserCardProps {
  user: Profile;
  onEdit: (user: Profile) => void;
  onDelete: (user: Profile) => void;
}

export const UserCard = ({ user, onEdit, onDelete }: UserCardProps) => {
  return (
    <div className="flex items-center justify-between p-4 border rounded-lg">
      <div>
        <h3 className="font-medium">
          {user.first_name} {user.last_name}
        </h3>
        <p className="text-sm text-muted-foreground">{user.email}</p>
        <p className="text-sm text-muted-foreground">Role: {user.role}</p>
        <p className="text-sm text-muted-foreground">Department: {user.department}</p>
        <p className="text-sm text-muted-foreground">Phone: {user.phone}</p>
        <p className="text-sm text-muted-foreground">DNI/NIE: {user.dni}</p>
        <p className="text-sm text-muted-foreground">Residencia: {user.residencia}</p>
      </div>
      <div className="flex gap-2">
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => onEdit(user)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button 
          variant="outline" 
          size="icon"
          onClick={() => onDelete(user)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};