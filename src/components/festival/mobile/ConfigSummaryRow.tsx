import { ChevronRight, CheckCircle2, AlertCircle, type LucideIcon } from "lucide-react";

interface ConfigSummaryRowProps {
  icon: LucideIcon;
  title: string;
  summary: string;
  warning?: boolean;
  mode?: 'edit' | 'readonly';
  onClick: () => void;
}

export const ConfigSummaryRow = ({ icon: Icon, title, summary, warning, onClick }: ConfigSummaryRowProps) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full min-w-0 overflow-hidden p-3 rounded-lg border bg-card hover:bg-accent/50 active:bg-accent/70 transition-colors flex items-center gap-3"
  >
    <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
      <Icon size={18} />
    </div>

    <div className="flex-1 min-w-0 text-left overflow-hidden">
      <div className="flex items-center gap-2 mb-0.5 min-w-0">
        <span className="text-sm font-semibold truncate">{title}</span>
        {warning ? (
          <AlertCircle size={14} className="text-amber-500 shrink-0" />
        ) : (
          <CheckCircle2 size={14} className="text-emerald-500/60 shrink-0" />
        )}
      </div>
      <div className="text-xs text-muted-foreground leading-4 break-words">{summary}</div>
    </div>

    <ChevronRight size={16} className="text-muted-foreground/50 shrink-0" />
  </button>
);
