import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { MessageCard } from "./MessageCard";
import { useMessagesQuery } from "./hooks/useMessagesQuery";
import { useMessageOperations } from "./hooks/useMessageOperations";
import { useTabVisibility } from "@/hooks/useTabVisibility";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export const MessagesList = () => {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const { toast } = useToast();

  // Add tab visibility hook to refresh messages when tab becomes visible
  useTabVisibility(['messages', 'direct_messages']);

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, department')
          .eq('id', user.id)
          .single();

        if (profile) {
          setUserRole(profile.role);
          setUserDepartment(profile.department);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  const { messages, loading, isFetching, setMessages } = useMessagesQuery(userRole, userDepartment);
  const { handleDeleteMessage, handleMarkAsRead } = useMessageOperations(messages, setMessages, toast);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-3/4 mb-2" />
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-y-auto">
      {isFetching && !loading && (
        <div className="text-xs text-muted-foreground mb-2">Actualizando mensajes...</div>
      )}
      {messages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No hay mensajes en este departamento.</p>
          </CardContent>
        </Card>
      ) : (
        messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            currentUserId={userRole === 'management' ? message.sender_id : undefined}
            onDelete={handleDeleteMessage}
            onMarkAsRead={handleMarkAsRead}
            isManagement={userRole === 'management'}
          />
        ))
      )}
    </div>
  );
};