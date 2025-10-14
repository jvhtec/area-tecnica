
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Profile } from "./types";
import { AlertTriangle, Pencil, Trash2, Award } from "lucide-react";
import { formatUserName } from "@/utils/userName";

interface UserCardProps {
  user: Profile;
  onEdit: (user: Profile) => void;
  onDelete: (user: Profile) => void;
  showPasswordAlert?: boolean;
  onManageSkills?: (user: Profile) => void;
}

export const UserCard = ({ user, onEdit, onDelete, showPasswordAlert = false, onManageSkills }: UserCardProps) => {
  const fullName = formatUserName(user.first_name, user.nickname, user.last_name);

  return (
    <div className="group flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 transition-colors">
      <HoverCard>
        <HoverCardTrigger asChild>
          <div className="flex items-center gap-3 cursor-pointer">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-medium">{fullName || user.email}</span>
                {showPasswordAlert && (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
            <div className="flex gap-1">
              <Badge variant="secondary">{user.role}</Badge>
              {user.department && (
                <Badge variant="outline">{user.department}</Badge>
              )}
            </div>
          </div>
        </HoverCardTrigger>
        <HoverCardContent className="w-80">
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">User Details</h4>
            <div className="text-sm">
              <p><span className="font-medium">Phone:</span> {user.phone || 'Not provided'}</p>
              <p><span className="font-medium">DNI/NIE:</span> {user.dni || 'Not provided'}</p>
              <p><span className="font-medium">Residencia:</span> {user.residencia || 'Not provided'}</p>
            </div>
          </div>
        </HoverCardContent>
      </HoverCard>

      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onManageSkills && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onManageSkills(user)}
            className="h-8"
          >
            <Award className="h-4 w-4 mr-1" /> Skills
          </Button>
        )}
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
