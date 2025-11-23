import { Button } from "@/components/ui/button";
import { CheckCircle, MessageSquare, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DirectMessage } from "./types";

interface DirectMessageCardProps {
  message: DirectMessage;
  currentUserId?: string;
  onDelete: (messageId: string) => void;
  onMarkAsRead: (messageId: string) => void;
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

export const DirectMessageCard = ({
  message,
  currentUserId,
  onDelete,
  onMarkAsRead,
  theme,
  isDark = false
}: DirectMessageCardProps) => {
  const isRecipient = message.recipient_id === currentUserId;
  const showMarkAsRead = isRecipient && message.status === 'unread';

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

  const handleDelete = () => {
    if (window.confirm('¿Seguro que deseas eliminar este mensaje de forma permanente?')) {
      onDelete(message.id);
    }
  };

  const isUnread = message.status === 'unread';
  const borderColor = isUnread ? (isDark ? 'border-blue-500/50' : 'border-blue-400') : t.divider;

  return (
    <div className={`rounded-xl border ${borderColor} p-4 ${isDark ? 'bg-white/5' : 'bg-white'} transition-colors relative`}>
      {isUnread && (
        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-blue-500"></div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isDark ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>
            <MessageSquare className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className={`font-bold text-sm ${t.textMain}`}>
              {message.sender.first_name} {message.sender.last_name}
            </span>
            <span className={`text-xs ${t.textMuted}`}>
              para {message.recipient.first_name} {message.recipient.last_name} • {format(new Date(message.created_at), 'PPp', { locale: es })}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 pr-4">
          {showMarkAsRead && (
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
          {(currentUserId === message.sender_id || currentUserId === message.recipient_id) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDelete}
              title="Eliminar mensaje"
              className={`h-8 w-8 p-0 ${t.textMuted} hover:text-red-500`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <p className={`text-sm ${t.textMain} whitespace-pre-wrap pl-[44px]`}>{message.content}</p>
    </div>
  );
};