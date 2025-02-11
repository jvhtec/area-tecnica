
import { useState } from "react";
import { Profile } from "./types";
import { UserCard } from "./UserCard";
import { EditUserDialog } from "./EditUserDialog";
import { DeleteUserDialog } from "./DeleteUserDialog";
import { useUserManagement } from "./hooks/useUserManagement";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";

interface UsersListContentProps {
  users: Profile[];
  groupBy?: 'department' | 'role' | null;
}

export const UsersListContent = ({ users, groupBy }: UsersListContentProps) => {
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [deletingUser, setDeletingUser] = useState<Profile | null>(null);
  
  const { handleDelete, handleSaveEdit } = useUserManagement();

  const handleEdit = (user: Profile) => {
    if (user?.id) {
      setEditingUser(user);
    }
  };

  const handleDeleteClick = (user: Profile) => {
    if (user?.id) {
      setDeletingUser(user);
    }
  };

  if (!groupBy) {
    return (
      <ScrollArea className="h-[600px]">
        <div className="space-y-2">
          {users.map((user) => (
            user?.id ? (
              <UserCard
                key={user.id}
                user={user}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
              />
            ) : null
          ))}
        </div>

        <EditUserDialog
          user={editingUser}
          onOpenChange={(open) => !open && setEditingUser(null)}
          onSave={handleSaveEdit}
        />

        <DeleteUserDialog
          user={deletingUser}
          onConfirm={() => deletingUser && handleDelete(deletingUser)}
          onCancel={() => setDeletingUser(null)}
        />
      </ScrollArea>
    );
  }

  const groupedUsers = users.reduce<Record<string, Profile[]>>((acc, user) => {
    const key = groupBy === 'department' ? (user.department || 'Unassigned') : (user.role || 'Unassigned');
    return { ...acc, [key]: [...(acc[key] || []), user] };
  }, {});

  return (
    <>
      <Accordion type="multiple" className="w-full">
        {Object.entries(groupedUsers).map(([group, groupUsers]) => (
          <AccordionItem key={group} value={group}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <span className="font-medium">{group}</span>
                <Badge variant="secondary" className="ml-2">
                  {groupUsers.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {groupUsers.map((user) => (
                    user?.id ? (
                      <UserCard
                        key={user.id}
                        user={user}
                        onEdit={handleEdit}
                        onDelete={handleDeleteClick}
                      />
                    ) : null
                  ))}
                </div>
              </ScrollArea>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      <EditUserDialog
        user={editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSave={handleSaveEdit}
      />

      <DeleteUserDialog
        user={deletingUser}
        onConfirm={() => deletingUser && handleDelete(deletingUser)}
        onCancel={() => setDeletingUser(null)}
      />
    </>
  );
};
