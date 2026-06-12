import React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { HojaDeRutaPrintSectionId } from "@/utils/hoja-de-ruta/pdf";

interface PrintSectionExclusionToggleProps {
  sectionId: HojaDeRutaPrintSectionId;
  isExcluded: boolean;
  onExcludedChange: (sectionId: HojaDeRutaPrintSectionId, isExcluded: boolean) => void;
  className?: string;
}

export const PrintSectionExclusionToggle: React.FC<PrintSectionExclusionToggleProps> = ({
  sectionId,
  isExcluded,
  onExcludedChange,
  className,
}) => {
  const checkboxId = `print-exclusion-${sectionId}`;

  return (
    <div className={cn("flex shrink-0 items-center gap-2", className)}>
      <Checkbox
        id={checkboxId}
        checked={isExcluded}
        onCheckedChange={(checked) => onExcludedChange(sectionId, checked === true)}
      />
      <Label htmlFor={checkboxId} className="cursor-pointer whitespace-nowrap text-sm font-medium text-muted-foreground">
        Excluir al imprimir
      </Label>
    </div>
  );
};
