
import { AlertTriangle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GearMismatch } from "@/utils/gearComparisonService";

interface GearMismatchIndicatorProps {
  mismatches: GearMismatch[];
  compact?: boolean;
}

export const GearMismatchIndicator = ({ mismatches, compact = false }: GearMismatchIndicatorProps) => {
  if (mismatches.length === 0) {
    return compact ? (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        ✓
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-green-100 text-green-800">
        No Issues
      </Badge>
    );
  }

  const errors = mismatches.filter(m => m.severity === 'error');
  const warnings = mismatches.filter(m => m.severity === 'warning');
  
  const tooltipContent = (
    <div className="max-w-sm space-y-2">
      <p className="font-medium">Equipment Issues:</p>
      {errors.length > 0 && (
        <div>
          <p className="text-red-600 font-medium text-xs">Errors ({errors.length}):</p>
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
          <p className="text-orange-600 font-medium text-xs">Warnings ({warnings.length}):</p>
          {warnings.map((warning, index) => (
            <div key={index} className="text-xs">
              <p className="text-orange-600">• {warning.message}</p>
              {warning.details && <p className="text-gray-500 ml-2">{warning.details}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
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
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          {errors.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              <XCircle className="h-3 w-3 mr-1" />
              {errors.length} Error{errors.length !== 1 ? 's' : ''}
            </Badge>
          )}
          {warnings.length > 0 && (
            <Badge variant="outline" className="text-xs bg-orange-100 text-orange-800 border-orange-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {warnings.length} Warning{warnings.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
};
