import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { stageNumbers, type PrintOptions, type PrintSection } from "@/features/festival-print/model";

const CHECKBOX_CLASS =
  "data-[state=checked]:bg-primary data-[state=checked]:border-primary dark:border-gray-500 dark:data-[state=checked]:bg-primary dark:data-[state=checked]:border-primary";

interface PrintSectionRowProps {
  section: PrintSection;
  options: PrintOptions;
  maxStages: number;
  /** Whether the one-click download is offered (it needs the job). */
  canDownload: boolean;
  onIncludeChange: (checked: boolean) => void;
  onStageChange: (stageNumber: number, checked: boolean) => void;
  onDownload: () => void;
  children?: React.ReactNode;
}

/** One document of the print dialog: include checkbox, optional quick download, stage picker and hint. */
export const PrintSectionRow = ({
  section,
  options,
  maxStages,
  canDownload,
  onIncludeChange,
  onStageChange,
  onDownload,
  children,
}: PrintSectionRowProps) => {
  const included = options[section.include];
  const stages = section.stages ? options[section.stages] : null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Checkbox
            id={section.id}
            checked={included}
            onCheckedChange={(checked) => onIncludeChange(checked === true)}
            className={CHECKBOX_CLASS}
          />
          <Label
            htmlFor={section.id}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
          >
            {section.label}
          </Label>
        </div>
        {section.download && canDownload && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            className="h-8 px-2"
            title={`Descargar solo: ${section.label}`}
            aria-label={`Descargar solo: ${section.label}`}
          >
            <Download className="h-4 w-4" />
          </Button>
        )}
      </div>

      {included && stages && maxStages > 1 && (
        <div className="pl-4 sm:pl-6 space-y-2">
          <p className="text-xs sm:text-sm text-muted-foreground">Selecciona los escenarios:</p>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {stageNumbers(maxStages).map((stageNumber) => (
              <div key={stageNumber} className="flex items-center space-x-2">
                <Checkbox
                  id={`${section.id}-stage-${stageNumber}`}
                  checked={stages.includes(stageNumber)}
                  onCheckedChange={(checked) => onStageChange(stageNumber, checked === true)}
                  className={CHECKBOX_CLASS}
                />
                <Label
                  htmlFor={`${section.id}-stage-${stageNumber}`}
                  className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-gray-200"
                >
                  Escenario {stageNumber}
                </Label>
              </div>
            ))}
          </div>
        </div>
      )}

      {section.hint && <div className="pl-6 text-sm text-muted-foreground dark:text-gray-300">{section.hint}</div>}
      {children}
    </div>
  );
};
