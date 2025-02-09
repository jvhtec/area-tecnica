import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DirectMessage } from "./types";
import { DirectMessageCard } from "./DirectMessageCard";
import { useMessagesSubscription } from "./hooks/useMessagesSubscription";
import { useDirectMessageOperations } from "./hooks/useDirectMessageOperations";

export const DirectMessagesList = () => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const { toast } = useToast();
  const { handleDeleteMessage, handleMarkAsRead } = useDirectMessageOperations(messages, setMessages, toast);

  useEffect(() => {
    const getCurrentUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          console.error("Error getting current user:", error);
          return;
        }
        if (user) {
          console.log("Current user set:", user.id);
          setCurrentUserId(user.id);
          await fetchMessages(user.id);
        }
      } catch (error) {
        console.error("Error in getCurrentUser:", error);
      }
    };
    getCurrentUser();
  }, []);

  const fetchMessages = async (userId: string) => {
    try {
      console.log("Fetching direct messages for user:", userId);
      setLoading(true);

      const [receivedMessages, sentMessages] = await Promise.all([
        supabase
          .from('direct_messages')
          .select(`
            *,
            sender:profiles!direct_messages_sender_id_fkey(id, first_name, last_name),
            recipient:profiles!direct_messages_recipient_id_fkey(id, first_name, last_name)
          `)
          .eq('recipient_id', userId)
          .order('created_at', { ascending: false }),
        
        supabase
          .from('direct_messages')
          .select(`
            *,
            sender:profiles!direct_messages_sender_id_fkey(id, first_name, last_name),
            recipient:profiles!direct_messages_recipient_id_fkey(id, first_name, last_name)
          `)
          .eq('sender_id', userId)
          .order('created_at', { ascending: false })
      ]);

      if (receivedMessages.error) {
        console.error("Error fetching received messages:", receivedMessages.error);
        throw receivedMessages.error;
      }
      if (sentMessages.error) {
        console.error("Error fetching sent messages:", sentMessages.error);
        throw sentMessages.error;
      }

      const allMessages = [...(receivedMessages.data || []), ...(sentMessages.data || [])];
      const uniqueMessages = Array.from(
        new Map(allMessages.map(message => [message.id, message])).values()
      );
      const sortedMessages = uniqueMessages.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      console.log("All messages fetched:", sortedMessages);
      setMessages(sortedMessages);
    } catch (error) {
      console.error("Error in fetchMessages:", error);
      toast({
        title: "Error",
        description: "Failed to fetch messages",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useMessagesSubscription(currentUserId, () => {
    if (currentUserId) {
      console.log("Refreshing messages after subscription update");
      fetchMessages(currentUserId);
    }
  });

  return (
    <div className="space-y-4">
      {loading ? (
        <p className="text-muted-foreground">Loading messages...</p>
      ) : messages.length === 0 ? (
        <p className="text-muted-foreground">No direct messages.</p>
      ) : (
        messages.map((message) => (
          <DirectMessageCard
            key={message.id}
            message={message}
            currentUserId={currentUserId}
            onDelete={handleDeleteMessage}
            onMarkAsRead={handleMarkAsRead}
          />
        ))
      )}
    </div>
  );
};