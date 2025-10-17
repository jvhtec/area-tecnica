import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, Trash2, CheckCircle, Reply } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Message } from "./types";
import { DirectMessageDialog } from "./DirectMessageDialog";

interface MessageCardProps {
  message: Message;
  currentUserId: string | undefined;
  onDelete?: (messageId: string) => void;
  onMarkAsRead?: (messageId: string) => void;
  isManagement?: boolean;
}

export const MessageCard = ({ 
  message, 
  currentUserId,
  onDelete,
  onMarkAsRead,
  isManagement
}: MessageCardProps) => {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const showMarkAsRead = isManagement && message.status === 'unread';
  const canReply = isManagement && !!message.sender_id; // only management replies to department messages

  return (
    <Card key={message.id}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">
                {message.sender.first_name} {message.sender.last_name}
              </span>
              <span className="text-sm text-muted-foreground">
                Departamento: {message.department}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(message.created_at), 'PPp', { locale: es })}
            </span>
            {canReply && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsReplyOpen(true)}
                title="Responder al remitente"
                className="gap-2"
              >
                <Reply className="h-4 w-4" />
                Reply
              </Button>
            )}
            {showMarkAsRead && onMarkAsRead && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onMarkAsRead(message.id)}
                title="Marcar como leído"
              >
                <CheckCircle className="h-4 w-4" />
              </Button>
            )}
            {(message.sender_id === currentUserId || isManagement) && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(message.id)}
                title="Eliminar mensaje"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2">{message.content}</p>
        {canReply && (
          <DirectMessageDialog
            open={isReplyOpen}
            onOpenChange={setIsReplyOpen}
            recipientId={message.sender_id}
            recipientName={`${message.sender.first_name} ${message.sender.last_name}`}
          />
        )}
      </CardContent>
    </Card>
  );
};
