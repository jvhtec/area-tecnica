import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useIsMobile } from "@/hooks/useMediaQuery";

export type ToolStepStatus = "complete" | "current" | "upcoming";

export interface ToolStepDefinition {
  id: string;
  title: string;
  description?: string;
  content: React.ReactNode;
  status?: ToolStepStatus;
  disabled?: boolean;
}

export interface ToolStepFlowProps {
  steps: ToolStepDefinition[];
  activeStepId: string;
  onStepChange?: (stepId: string) => void;
  className?: string;
}

const statusStyles: Record<ToolStepStatus, string> = {
  complete: "border-emerald-500 bg-emerald-500 text-white",
  current: "border-primary bg-primary text-primary-foreground",
  upcoming: "border-muted bg-background text-muted-foreground",
};

export const ToolStepFlow: React.FC<ToolStepFlowProps> = ({
  steps,
  activeStepId,
  onStepChange,
  className,
}) => {
  const isMobile = useIsMobile();
  const activeIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === activeStepId)
  );

  const deriveStatus = (step: ToolStepDefinition, index: number): ToolStepStatus => {
    if (step.status) return step.status;
    if (index < activeIndex) return "complete";
    if (index === activeIndex) return "current";
    return "upcoming";
  };

  if (isMobile) {
    return (
      <Accordion
        type="single"
        collapsible
        value={activeStepId}
        onValueChange={(value) => {
          if (!value) return;
          onStepChange?.(value);
        }}
        className={className}
      >
        {steps.map((step, index) => {
          const status = deriveStatus(step, index);
          const isCompleted = status === "complete";
          return (
            <AccordionItem key={step.id} value={step.id} disabled={step.disabled}>
              <AccordionTrigger className="px-3">
                <div className="flex w-full items-center gap-3 text-left">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                      statusStyles[status]
                    )}
                  >
                    {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.title}</p>
                    {step.description && (
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    )}
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-1 pb-4">
                <div className="rounded-lg border bg-card p-4 shadow-sm">
                  {step.content}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  }

  const activeStep = steps[activeIndex] ?? steps[0];

  return (
    <div className={cn("grid gap-6 md:grid-cols-[220px_1fr]", className)}>
      <ol className="space-y-4">
        {steps.map((step, index) => {
          const status = deriveStatus(step, index);
          const isCompleted = status === "complete";
          const isActive = step.id === activeStepId;
          return (
            <li key={step.id}>
              <button
                type="button"
                disabled={step.disabled}
                onClick={() => onStepChange?.(step.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                  isActive && "border-primary bg-primary/10",
                  !isActive && "hover:bg-muted/60",
                  step.disabled && "cursor-not-allowed opacity-60"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold",
                    statusStyles[status]
                  )}
                >
                  {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{step.title}</p>
                  {step.description && (
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="rounded-xl border bg-card p-5 shadow-sm">
        {activeStep?.content}
      </div>
    </div>
  );
};

ToolStepFlow.displayName = "ToolStepFlow";

export default ToolStepFlow;
