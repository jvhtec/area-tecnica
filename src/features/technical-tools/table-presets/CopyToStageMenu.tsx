import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Copy } from "lucide-react";
import type { TechnicalStage } from "@/features/technical-tools/stage/stageUtils";

/**
 * Dropdown listing the job's stages (minus the excluded one) as copy targets.
 * Used both per-table and for whole-set copies in the Consumos/Pesos tools.
 */
export const CopyToStageMenu = ({
  label,
  stages,
  excludeStageNumber,
  iconOnly = false,
  onCopy,
}: {
  label: string;
  stages: TechnicalStage[];
  /** Stage the source tables already live on; hidden from the target list. */
  excludeStageNumber?: number | null;
  iconOnly?: boolean;
  onCopy: (stage: TechnicalStage) => void;
}) => {
  const targets = stages.filter(
    (stage) => excludeStageNumber == null || stage.number !== excludeStageNumber,
  );
  if (targets.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {iconOnly ? (
          <Button variant="outline" size="sm" className="gap-1" aria-label={label} title={label}>
            <Copy className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="outline" className="gap-2">
            <Copy className="h-4 w-4" />
            {label}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {targets.map((stage) => (
          <DropdownMenuItem key={stage.number} onClick={() => onCopy(stage)}>
            {stage.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
