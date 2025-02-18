
import { UserCard } from "./UserCard";
import { Loader2 } from "lucide-react";

interface UsersListContentProps {
  users: any[];
  isLoading: boolean;
  onEditClick: (user: any) => void;
  onDeleteClick: (user: any) => void;
}

export const UsersListContent = ({
  users,
  isLoading,
  onEditClick,
  onDeleteClick,
}: UsersListContentProps) => {
  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onEdit={onEditClick}
          onDelete={onDeleteClick}
        />
      ))}
    </div>
  );
};
