import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

interface MessageReplyDialogProps {
  message: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MessageReplyDialog = ({ message, open, onOpenChange }: MessageReplyDialogProps) => {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!reply.trim()) return;

    try {
      setSending(true);
      console.log("Sending reply...");

      // Mark original message as read
      const { error: updateError } = await supabase
        .from('messages')
        .update({ status: 'read' })
        .eq('id', message.id);

      if (updateError) throw updateError;

      // Send reply message
      const { error: sendError } = await supabase
        .from('messages')
        .insert({
          content: reply,
          department: message.department,
          sender_id: message.sender_id,
        });

      if (sendError) throw sendError;

      toast({
        title: "Reply sent",
        description: "Your reply has been sent successfully.",
      });
      
      setReply("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending reply:", error);
      toast({
        title: "Error",
        description: "Failed to send reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const formatMessageDate = (dateString: string) => {
    try {
      if (!dateString) return '';
      const date = parseISO(dateString);
      return format(date, 'PPp');
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reply to Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-muted p-4 rounded-lg">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>{message?.sender?.first_name} {message?.sender?.last_name}</span>
              <span>{message?.created_at ? formatMessageDate(message.created_at) : ''}</span>
            </div>
            <p>{message?.content}</p>
          </div>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Type your reply..."
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={sending || !reply.trim()}
          >
            {sending ? "Sending..." : "Send Reply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};