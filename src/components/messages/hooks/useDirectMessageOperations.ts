import { DirectMessage } from "../types";
import { supabase } from "@/lib/supabase";
import { ToastActionElement, ToastProps } from "@/components/ui/toast";

type Toast = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
  action?: ToastActionElement;
} & Partial<ToastProps>;

export const useDirectMessageOperations = (
  messages: DirectMessage[],
  setMessages: React.Dispatch<React.SetStateAction<DirectMessage[]>>,
  toast: (props: Toast) => void
) => {
  const handleDeleteMessage = async (messageId: string) => {
    try {
      console.log("Deleting direct message:", messageId);
      const { data: deleted, error } = await supabase
        .from("direct_messages")
        .delete()
        .eq("id", messageId)
        .select("id");

      if (error) throw error;
      if (!deleted || deleted.length === 0) {
        throw new Error("No rows deleted. You may not have permission to delete this direct message.");
      }

      setMessages(prevMessages => prevMessages.filter(message => message.id !== messageId));
      // Notify other UI to refresh direct messages state
      try {
        window.dispatchEvent(new Event('direct_messages_invalidated'));
      } catch (_) {
        // no-op in non-browser environments
      }
      toast({
        title: "Success",
        description: "Message deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting direct message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      console.log("Marking direct message as read:", messageId);
      const { data: updated, error } = await supabase
        .from('direct_messages')
        .update({ status: 'read' })
        .eq('id', messageId)
        .select('id');

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('No rows updated. You may not have permission to update this direct message.');
      }

      setMessages(messages.map(message =>
        message.id === messageId
          ? { ...message, status: 'read' }
          : message
      ));
      // Notify other UI to refresh direct messages state
      try {
        window.dispatchEvent(new Event('direct_messages_invalidated'));
      } catch (_) {
        // no-op in non-browser environments
      }
      
      toast({
        title: "Success",
        description: "Message marked as read",
      });
    } catch (error) {
      console.error("Error marking direct message as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark message as read",
        variant: "destructive",
      });
    }
  };

  return {
    handleDeleteMessage,
    handleMarkAsRead,
  };
};
