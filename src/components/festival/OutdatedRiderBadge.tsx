import { useState } from "react";
import { History, X, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface OutdatedRiderBadgeProps {
  artistId: string;
  copiedFromDate: string | null | undefined;
  /** Called after the warning is successfully dismissed, to refresh the list. */
  onDismissed?: () => void;
  compact?: boolean;
}

const formatSourceDate = (date: string | null | undefined): string => {
  if (!date) return "otra fecha";
  // Parse as a date-only value (parseISO treats "YYYY-MM-DD" as local midnight)
  // so a Postgres `date` isn't shifted back a day for users behind UTC.
  const parsed = parseISO(date);
  return Number.isNaN(parsed.getTime()) ? date : format(parsed, "d 'de' MMMM 'de' yyyy", { locale: es });
};

// Warns that an artist's rider/specs were copied from a previous show date and
// may be stale. Details surface on hover (desktop) or tap (mobile); the warning
// is dismissible per artist ("defeatable"), after which the row falls back to
// the normal rider status badge.
export const OutdatedRiderBadge = ({ artistId, copiedFromDate, onDismissed, compact = false }: OutdatedRiderBadgeProps) => {
  const isMobile = useIsMobile();
  const [isDismissing, setIsDismissing] = useState(false);

  const handleDismiss = async () => {
    if (isDismissing) return;
    setIsDismissing(true);
    try {
      const { error } = await supabase
        .from("festival_artists")
        .update({ rider_outdated_dismissed: true })
        .eq("id", artistId);
      if (error) throw error;
      onDismissed?.();
    } catch (error) {
      console.error("Error dismissing outdated rider warning:", error);
      toast.error("No se pudo descartar el aviso de rider desactualizado");
    } finally {
      setIsDismissing(false);
    }
  };

  const badge = (
    <Badge
      variant="outline"
      className={`bg-amber-100 text-amber-900 border-amber-300 ${compact ? "text-[10px] px-1 py-0" : "text-xs"}`}
    >
      <History className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} mr-1`} />
      Rider antiguo
    </Badge>
  );

  const details = (
    <div className="max-w-xs space-y-1.5">
      <p className="font-medium text-amber-900">Rider posiblemente desactualizado</p>
      <p className="text-xs text-muted-foreground">
        Copiado de la fecha {formatSourceDate(copiedFromDate)}.
      </p>
      <p className="text-xs text-muted-foreground">
        Solicita un rider más reciente si es posible antes de la producción.
      </p>
    </div>
  );

  const trigger = (
    <button
      type="button"
      aria-label="Ver detalles del rider desactualizado"
      className="appearance-none border-0 bg-transparent p-0 cursor-pointer"
      onClick={(e) => e.stopPropagation()}
    >
      {badge}
    </button>
  );

  return (
    <div className="flex items-center gap-1">
      {isMobile ? (
        <Popover>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent className="w-auto max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            {details}
          </PopoverContent>
        </Popover>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>{trigger}</TooltipTrigger>
          <TooltipContent>{details}</TooltipContent>
        </Tooltip>
      )}
      <button
        type="button"
        aria-label="Descartar aviso de rider desactualizado"
        title="Descartar aviso"
        className="appearance-none border-0 bg-transparent p-0 text-amber-700 hover:text-amber-900 disabled:opacity-50"
        disabled={isDismissing}
        onClick={(e) => {
          e.stopPropagation();
          handleDismiss();
        }}
      >
        {isDismissing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
};
