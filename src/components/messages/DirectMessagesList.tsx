
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { DirectMessage } from "./types";
import { DirectMessageCard } from "./DirectMessageCard";
import { useDirectMessageOperations } from "./hooks/useDirectMessageOperations";
import { useTableSubscription } from "@/hooks/useSubscription";
import { SubscriptionIndicator } from "../ui/subscription-indicator";
import { useQueryClient } from "@tanstack/react-query";

export const DirectMessagesList = () => {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { handleDeleteMessage, handleMarkAsRead } = useDirectMessageOperations(messages, setMessages, toast);

  // Set up real-time subscription using the improved hooks
  useTableSubscription('direct_messages', 'direct_messages');

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

  // Set up a listener to invalidate and refetch when messages change
  useEffect(() => {
    if (!currentUserId) return;
    
    const refreshData = () => {
      console.log("Message subscription triggered refresh");
      fetchMessages(currentUserId);
    };
    
    // Listen for invalidations from the subscription manager
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      // Handle proper event types from React Query cache
      if (event.type === 'updated' || event.type === 'added') {
        // For updated or added events, check if it's related to direct_messages
        const queryKey = event.query?.queryKey;
        if (queryKey && queryKey[0] === 'direct_messages') {
          refreshData();
        }
      }
    });
    
    // Set up direct invalidation event
    const handleInvalidate = () => refreshData();
    window.addEventListener('direct_messages_invalidated', handleInvalidate);
    
    return () => {
      unsubscribe();
      window.removeEventListener('direct_messages_invalidated', handleInvalidate);
    };
  }, [currentUserId, queryClient]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <h3 className="text-lg font-medium">Direct Messages</h3>
        <SubscriptionIndicator tables={['direct_messages']} variant="compact" />
      </div>
      
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
}
