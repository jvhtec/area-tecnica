
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
    <div className="group border rounded-lg hover:bg-accent/5 transition-colors overflow-visible">
      <div className="flex items-start sm:items-center justify-between p-1.5 sm:p-3 gap-1 sm:gap-2">
        <HoverCard>
          <HoverCardTrigger asChild>
            <div className="flex flex-col gap-1.5 cursor-pointer flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-sm sm:text-base truncate">{fullName || user.email}</span>
                {showPasswordAlert && (
                  <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-warning shrink-0" />
                )}
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground truncate">{user.email}</span>
              <div className="flex gap-1 flex-wrap">
                <Badge variant="secondary" className="text-xs">{user.role}</Badge>
                {user.department && (
                  <Badge variant="outline" className="text-xs">{user.department}</Badge>
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

        <div className="flex gap-0.5 sm:gap-2 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity -mr-1 sm:mr-0">
          {onManageSkills && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManageSkills(user)}
              className="h-6 px-1 sm:h-8 sm:px-3 text-[10px] sm:text-xs"
            >
              <Award className="h-2.5 w-2.5 sm:h-4 sm:w-4 sm:mr-1" />
              <span className="hidden sm:inline">Skills</span>
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => onEdit(user)}
            className="h-6 w-6 p-0 sm:h-9 sm:w-9"
          >
            <Pencil className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => onDelete(user)}
            className="h-6 w-6 p-0 sm:h-9 sm:w-9"
          >
            <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};
