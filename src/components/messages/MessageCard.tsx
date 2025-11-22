import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, Trash2, CheckCircle, Reply, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Message } from "./types";
import { DirectMessageDialog } from "./DirectMessageDialog";

interface MessageCardProps {
  message: Message;
  currentUserId: string | undefined;
  onDelete?: (messageId: string) => void;
  onMarkAsRead?: (messageId: string) => void;
  onGrantSoundVisionAccess?: (messageId: string, vacationRequestId: string) => void;
  isManagement?: boolean;
  theme?: {
    bg: string;
    nav: string;
    card: string;
    textMain: string;
    textMuted: string;
    accent: string;
    input: string;
    modalOverlay: string;
    divider: string;
    danger: string;
    success: string;
    warning: string;
    cluster: string;
  };
  isDark?: boolean;
}

export const MessageCard = ({
  message,
  currentUserId,
  onDelete,
  onMarkAsRead,
  onGrantSoundVisionAccess,
  isManagement,
  theme,
  isDark = false
}: MessageCardProps) => {
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const showMarkAsRead = isManagement && message.status === 'unread';
  const canReply = isManagement && !!message.sender_id; // only management replies to department messages

  // Check if this is a SoundVision access request message
  const isSoundVisionRequest = message.metadata?.type === 'soundvision_access_request';
  const vacationRequestId = message.metadata?.vacation_request_id;

  // Default theme fallback
  const t = theme || {
    bg: isDark ? "bg-[#05070a]" : "bg-slate-50",
    nav: isDark ? "bg-[#0f1219] border-t border-[#1f232e]" : "bg-white border-t border-slate-200",
    card: isDark ? "bg-[#0f1219] border-[#1f232e]" : "bg-white border-slate-200 shadow-sm",
    textMain: isDark ? "text-white" : "text-slate-900",
    textMuted: isDark ? "text-[#94a3b8]" : "text-slate-500",
    accent: "bg-blue-600 hover:bg-blue-500 text-white",
    input: isDark ? "bg-[#0a0c10] border-[#2a2e3b] text-white focus:border-blue-500" : "bg-white border-slate-300 text-slate-900 focus:border-blue-500",
    modalOverlay: isDark ? "bg-black/90 backdrop-blur-md" : "bg-slate-900/40 backdrop-blur-md",
    divider: isDark ? "border-[#1f232e]" : "border-slate-100",
    danger: isDark ? "text-red-400 bg-red-500/10 border-red-500/20" : "text-red-700 bg-red-50 border-red-200",
    success: isDark ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" : "text-emerald-700 bg-emerald-50 border-emerald-200",
    warning: isDark ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-amber-700 bg-amber-50 border-amber-200",
    cluster: isDark ? "bg-white text-black" : "bg-slate-900 text-white"
  };

  return (
    <div className={`rounded-xl border ${t.divider} p-4 ${isDark ? 'bg-white/5' : 'bg-white'} transition-colors`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-blue-500/10 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className={`font-bold text-sm ${t.textMain}`}>
                {message.sender.first_name} {message.sender.last_name}
              </span>
              {isSoundVisionRequest && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 border border-purple-500/20 uppercase font-medium`}>
                  SV Access
                </span>
              )}
            </div>
            <span className={`text-xs ${t.textMuted}`}>
              {message.department} • {format(new Date(message.created_at), 'PPp', { locale: es })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {canReply && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsReplyOpen(true)}
              title="Responder al remitente"
              className={`h-8 w-8 p-0 ${t.textMuted} hover:${t.textMain}`}
            >
              <Reply className="h-4 w-4" />
            </Button>
          )}
          {showMarkAsRead && onMarkAsRead && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkAsRead(message.id)}
              title="Marcar como leído"
              className={`h-8 w-8 p-0 ${t.textMuted} hover:text-emerald-500`}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          )}
          {(message.sender_id === currentUserId || isManagement) && onDelete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(message.id)}
              title="Eliminar mensaje"
              className={`h-8 w-8 p-0 ${t.textMuted} hover:text-red-500`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <p className={`text-sm ${t.textMain} whitespace-pre-wrap pl-[44px]`}>{message.content}</p>

      {isSoundVisionRequest && isManagement && vacationRequestId && onGrantSoundVisionAccess && (
        <div className={`mt-4 pt-3 border-t ${t.divider} pl-[44px]`}>
          <Button
            variant="default"
            size="sm"
            onClick={() => onGrantSoundVisionAccess(message.id, vacationRequestId)}
            className={`gap-2 ${t.accent}`}
          >
            <UserCheck className="h-4 w-4" />
            Conceder Acceso SoundVision
          </Button>
        </div>
      )}

      {canReply && (
        <DirectMessageDialog
          open={isReplyOpen}
          onOpenChange={setIsReplyOpen}
          recipientId={message.sender_id}
          recipientName={`${message.sender.first_name} ${message.sender.last_name}`}
        />
      )}
    </div>
  );
};
