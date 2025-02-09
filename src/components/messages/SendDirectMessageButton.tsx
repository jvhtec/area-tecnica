import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { DirectMessageDialog } from "./DirectMessageDialog";

interface SendDirectMessageButtonProps {
  recipientId: string;
  recipientName: string;
}

export const SendDirectMessageButton = ({ 
  recipientId, 
  recipientName 
}: SendDirectMessageButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setDialogOpen(true)}
        className="gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        Message
      </Button>

      <DirectMessageDialog
        recipientId={recipientId}
        recipientName={recipientName}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};