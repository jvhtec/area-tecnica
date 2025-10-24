import { Message } from "../types";
import { supabase } from "@/lib/supabase";
import { toast as toastFunction } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useMessageOperations = (
  messages: Message[],
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  toast: typeof toastFunction
) => {
  const queryClient = useQueryClient();

  const handleDeleteMessage = async (messageId: string) => {
    try {
      console.log("Deleting message:", messageId);
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      toast({
        title: "Message deleted",
        description: "The message has been permanently deleted.",
      });

      setMessages(messages.filter(msg => msg.id !== messageId));
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete the message. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsRead = async (messageId: string) => {
    try {
      console.log("Marking message as read:", messageId);
      const { data: updated, error } = await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('id', messageId)
        .select('id');

      if (error) throw error;
      if (!updated || updated.length === 0) {
        throw new Error('No rows updated. You may not have permission to update this message.');
      }

      toast({
        title: "Message marked as read",
        description: "The message has been marked as read.",
      });

      setMessages(messages.map(msg => 
        msg.id === messageId ? { ...msg, status: 'read' } : msg
      ));

      // Proactively notify other UI (e.g., sidebar badge) to refresh
      try {
        window.dispatchEvent(new Event('messages_invalidated'));
      } catch (_) {
        // no-op in non-browser environments
      }
    } catch (error) {
      console.error("Error marking message as read:", error);
      toast({
        title: "Error",
        description: "Failed to mark the message as read. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleGrantSoundVisionAccess = async (messageId: string, vacationRequestId: string) => {
    try {
      console.log("Granting SoundVision access for vacation request:", vacationRequestId);
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // First, get the vacation request to find the technician
      const { data: vacationRequest, error: fetchError } = await supabase
        .from('vacation_requests')
        .select('technician_id, status')
        .eq('id', vacationRequestId)
        .single();

      if (fetchError) throw fetchError;
      if (!vacationRequest) throw new Error('Vacation request not found');

      // Safeguard: Check if already approved
      if (vacationRequest.status === 'approved') {
        toast({
          title: "Already Granted",
          description: "SoundVision access has already been granted for this request.",
          variant: "default",
        });
        return;
      }

      // Update profile to enable SoundVision access
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ soundvision_access_enabled: true })
        .eq('id', vacationRequest.technician_id);

      if (profileError) throw profileError;

      // Update vacation request to approved
      const { error: vacationError } = await supabase
        .from('vacation_requests')
        .update({
          status: 'approved',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', vacationRequestId);

      if (vacationError) throw vacationError;

      // Mark message as read
      const { error: messageError } = await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('id', messageId);

      if (messageError) throw messageError;

      // Update local state
      setMessages(messages.map(msg => 
        msg.id === messageId ? { ...msg, status: 'read' } : msg
      ));

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      queryClient.invalidateQueries({ queryKey: ['vacation_requests'] });

      // Notify other UI
      try {
        window.dispatchEvent(new Event('messages_invalidated'));
      } catch (_) {
        // no-op in non-browser environments
      }

      toast({
        title: "Access Granted",
        description: "SoundVision access has been successfully granted.",
      });

    } catch (error) {
      console.error("Error granting SoundVision access:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to grant SoundVision access. Please try again.",
        variant: "destructive",
      });
    }
  };

  return { handleDeleteMessage, handleMarkAsRead, handleGrantSoundVisionAccess };
};
