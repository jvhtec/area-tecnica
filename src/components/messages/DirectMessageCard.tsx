import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { DirectMessage } from "./types";

interface DirectMessageCardProps {
  message: DirectMessage;
  currentUserId?: string;
  onDelete: (messageId: string) => void;
  onMarkAsRead: (messageId: string) => void;
}

export const DirectMessageCard = ({
  message,
  currentUserId,
  onDelete,
  onMarkAsRead
}: DirectMessageCardProps) => {
  const isRecipient = message.recipient_id === currentUserId;
  const showMarkAsRead = isRecipient && message.status === 'unread';

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to permanently delete this message?')) {
      onDelete(message.id);
    }
  };

  return (
    <Card className={message.status === 'unread' ? 'border-primary' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="font-medium">
                {message.sender.first_name} {message.sender.last_name}
              </span>
              <span className="text-sm text-muted-foreground">
                to {message.recipient.first_name} {message.recipient.last_name}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {format(new Date(message.created_at), 'PPp')}
            </span>
            {showMarkAsRead && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onMarkAsRead(message.id)}
                className="flex items-center gap-2"
              >
                <CheckCircle className="h-4 w-4" />
                Mark as Read
              </Button>
            )}
            {(currentUserId === message.sender_id || currentUserId === message.recipient_id) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDelete}
                title="Delete message"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 whitespace-pre-wrap">{message.content}</p>
      </CardContent>
    </Card>
  );
};