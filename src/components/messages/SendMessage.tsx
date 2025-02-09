import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Send } from "lucide-react";
import { Department } from "@/types/department";

interface SendMessageProps {
  department: string;
}

export const SendMessage = ({ department }: SendMessageProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    try {
      setSending(true);
      console.log("Sending message...");

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("No user found");

      // Validate that the department is one of the allowed values
      if (!['sound', 'lights', 'video'].includes(department)) {
        throw new Error("Invalid department");
      }

      const { error } = await supabase
        .from('messages')
        .insert({
          content: message,
          sender_id: userData.user.id,
          department: department as Department // Type assertion here is safe because we validated above
        });

      if (error) throw error;

      console.log("Message sent successfully");
      setMessage("");
      toast({
        title: "Message sent",
        description: "Your message has been sent to management.",
      });
    } catch (error) {
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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message here..."
        className="min-h-[100px]"
      />
      <Button type="submit" disabled={sending || !message.trim()} className="w-full">
        {sending ? (
          "Sending..."
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Message
          </>
        )}
      </Button>
    </form>
  );
};