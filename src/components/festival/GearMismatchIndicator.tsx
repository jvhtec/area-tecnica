import type { ReactNode } from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { GearMismatch } from "@/utils/gearComparisonService";

interface GearMismatchIndicatorProps {
  mismatches: GearMismatch[];
  compact?: boolean;
}

export const GearMismatchIndicator = ({ mismatches, compact = false }: GearMismatchIndicatorProps) => {
  // Touch devices have no hover, so the hover-only Tooltip leaves the details
  // unreachable. On mobile we surface the same content in a tap-triggered Popover.
  const isMobile = useIsMobile();

  if (mismatches.length === 0) {
    return compact ? (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        ✓
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        Sin problemas
      </Badge>
    );
  }

  const errors = mismatches.filter(m => m.severity === 'error');
  const warnings = mismatches.filter(m => m.severity === 'warning');
  const infos = mismatches.filter(m => m.severity === 'info');

  const detailsContent = (
    <div className="max-w-sm space-y-2">
      <p className="font-medium">Estado del equipo:</p>
      {errors.length > 0 && (
        <div>
          <p className="text-red-600 font-medium text-xs">Errores ({errors.length}):</p>
          {errors.map((error, index) => (
            <div key={index} className="text-xs">
              <p className="text-red-600">• {error.message}</p>
              {error.details && <p className="text-gray-500 ml-2">{error.details}</p>}
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div>
          <p className="text-orange-600 font-medium text-xs">Advertencias ({warnings.length}):</p>
          {warnings.map((warning, index) => (
            <div key={index} className="text-xs">
              <p className="text-orange-600">• {warning.message}</p>
              {warning.details && <p className="text-gray-500 ml-2">{warning.details}</p>}
            </div>
          ))}
        </div>
      )}
      {infos.length > 0 && (
        <div>
          <p className="text-blue-600 font-medium text-xs">Información ({infos.length}):</p>
          {infos.map((info, index) => (
            <div key={index} className="text-xs">
              <p className="text-blue-600">• {info.message}</p>
              {info.details && <p className="text-gray-500 ml-2">{info.details}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const badges = compact ? (
    <div className="flex items-center gap-1">
      {errors.length > 0 && (
        <Badge variant="destructive" className="text-xs px-1">
          <XCircle className="h-3 w-3 mr-1" />
          {errors.length}
        </Badge>
      )}
      {warnings.length > 0 && (
        <Badge variant="outline" className="text-xs px-1 bg-orange-100 text-orange-800 border-orange-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {warnings.length}
        </Badge>
      )}
      {infos.length > 0 && (
        <Badge variant="outline" className="text-xs px-1 bg-blue-50 text-blue-600 border-blue-200">
          <Info className="h-3 w-3 mr-1" />
          {infos.length}
        </Badge>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      {errors.length > 0 && (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          {errors.length} Error{errors.length !== 1 ? 'es' : ''}
        </Badge>
      )}
      {warnings.length > 0 && (
        <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {warnings.length} Advertencia{warnings.length !== 1 ? 's' : ''}
        </Badge>
      )}
      {infos.length > 0 && (
        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
          <Info className="h-3 w-3 mr-1" />
          {infos.length} Información
        </Badge>
      )}
    </div>
  );

  return renderWithDetails(isMobile, badges, detailsContent);
};

/**
 * Wraps the badge row so the details are reachable on every device:
 * a hover/focus Tooltip on desktop, a tap-triggered Popover on touch.
 */
const renderWithDetails = (isMobile: boolean, trigger: ReactNode, content: ReactNode) => {
  if (isMobile) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Ver detalles del estado del equipo"
            className="appearance-none border-0 bg-transparent p-0 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          >
            {trigger}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent>{content}</TooltipContent>
    </Tooltip>
  );
};
