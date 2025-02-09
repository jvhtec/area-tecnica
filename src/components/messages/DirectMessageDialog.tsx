import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare } from "lucide-react";

interface DirectMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientId?: string;
  recipientName?: string;
}

interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export const DirectMessageDialog = ({ 
  open, 
  onOpenChange,
  recipientId: initialRecipientId,
  recipientName: initialRecipientName,
}: DirectMessageDialogProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | undefined>(initialRecipientId);
  const { toast } = useToast();

  useEffect(() => {
    const fetchProfiles = async () => {
      console.log("Fetching profiles for direct message dialog");
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .order('first_name');

      if (error) {
        console.error('Error fetching profiles:', error);
        return;
      }

      console.log("Fetched profiles:", data);
      setProfiles(data || []);
    };

    fetchProfiles();
  }, []);

  const handleSend = async () => {
    if (!message.trim() || !selectedRecipientId) return;

    try {
      setSending(true);
      console.log("Sending direct message to:", selectedRecipientId);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        throw new Error("No authenticated user found");
      }

      const { error } = await supabase
        .from('direct_messages')
        .insert({
          sender_id: session.user.id,
          recipient_id: selectedRecipientId,
          content: message.trim(),
          status: 'unread'
        });

      if (error) {
        console.error("Error inserting direct message:", error);
        throw error;
      }

      console.log("Direct message sent successfully");
      toast({
        title: "Message sent",
        description: "Your message has been sent successfully.",
      });
      
      setMessage("");
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const getRecipientName = (id: string) => {
    const profile = profiles.find(p => p.id === id);
    return profile ? `${profile.first_name} ${profile.last_name}` : '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            New Message
          </DialogTitle>
          <DialogDescription>
            Send a direct message to another user
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">To:</label>
            <Select
              value={selectedRecipientId}
              onValueChange={setSelectedRecipientId}
              disabled={!!initialRecipientId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select recipient">
                  {selectedRecipientId ? getRecipientName(selectedRecipientId) : "Select recipient"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {profiles.map((profile) => (
                  <SelectItem 
                    key={profile.id} 
                    value={profile.id}
                  >
                    {profile.first_name} {profile.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your message..."
            className="min-h-[100px]"
          />
        </div>
        <DialogFooter>
          <Button
            onClick={handleSend}
            disabled={sending || !message.trim() || !selectedRecipientId}
          >
            {sending ? "Sending..." : "Send Message"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};