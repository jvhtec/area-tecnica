import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { MessageCard } from "./MessageCard";
import { useMessagesQuery } from "./hooks/useMessagesQuery";
import { useMessageOperations } from "./hooks/useMessageOperations";
import { useTabVisibility } from "@/hooks/useTabVisibility";

interface MessagesListProps {
  theme?: {
    bg: string;
    nav: string;
    card: string;
    textMain: string;
    textMuted: string;
    accent: string;
    input: string;
    modalOverlay: string;
    divider: string;
    danger: string;
    success: string;
    warning: string;
    cluster: string;
  };
  isDark?: boolean;
}

export const MessagesList = ({ theme, isDark = false }: MessagesListProps) => {
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
  const { handleDeleteMessage, handleMarkAsRead, handleGrantSoundVisionAccess } = useMessageOperations(messages, setMessages, toast);

  if (loading) {
    return <div className={`text-sm ${theme?.textMuted || 'text-muted-foreground'} animate-pulse`}>Cargando mensajes...</div>;
  }

  return (
    <div className="space-y-4">
      {isFetching && !loading && (
        <div className={`text-xs ${theme?.textMuted || 'text-muted-foreground'} mb-2`}>Actualizando mensajes...</div>
      )}
      {messages.length === 0 ? (
        <p className={theme?.textMuted || 'text-muted-foreground'}>No hay mensajes en este departamento.</p>
      ) : (
        messages.map((message) => (
          <MessageCard
            key={message.id}
            message={message}
            currentUserId={userRole === 'management' ? message.sender_id : undefined}
            onDelete={handleDeleteMessage}
            onMarkAsRead={handleMarkAsRead}
            onGrantSoundVisionAccess={handleGrantSoundVisionAccess}
            isManagement={userRole === 'management'}
            theme={theme}
            isDark={isDark}
          />
        ))
      )}
    </div>
  );
};