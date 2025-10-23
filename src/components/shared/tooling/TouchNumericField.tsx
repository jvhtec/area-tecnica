import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ToolHelpOverlay,
  type ToolHelpOverlayProps,
  type ToolHelpAccent,
} from "./ToolHelpOverlay";

export interface TouchNumericFieldProps {
  id?: string;
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: React.ReactNode;
  quickIncrements?: number[];
  help?: Omit<ToolHelpOverlayProps, "trigger"> | null;
  accent?: ToolHelpAccent;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
  align?: "left" | "center" | "right";
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  required?: boolean;
}

const accentBorderClass: Record<ToolHelpAccent, string> = {
  default: "focus-visible:ring-primary",
  sound: "focus-visible:ring-emerald-500",
  lights: "focus-visible:ring-amber-500",
  video: "focus-visible:ring-indigo-500",
};

export const TouchNumericField: React.FC<TouchNumericFieldProps> = ({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  suffix,
  quickIncrements,
  help,
  accent = "default",
  disabled,
  className,
  inputClassName,
  align = "left",
  onBlur,
  onFocus,
  required,
}) => {
  const increments = useMemo(() => quickIncrements ?? [1, 2, 5, 10], [quickIncrements]);

  const handleIncrement = (amount: number) => {
    const base = typeof value === "number" ? value : parseFloat(value || "0");
    const next = isFinite(base) ? base + amount : amount;
    onChange(next.toString());
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive"> *</span>}
        </Label>
        {help && (
          <ToolHelpOverlay
            accent={accent}
            title={help.title}
            description={help.description}
            icon={help.icon}
            align={help.align}
          >
            {help.children}
          </ToolHelpOverlay>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          pattern="[0-9]*"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onFocus={onFocus}
          required={required}
          className={cn(
            "h-12 flex-1 rounded-md text-base",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            accentBorderClass[accent],
            align === "center" && "text-center",
            align === "right" && "text-right",
            inputClassName
          )}
        />
        {suffix ? (
          <div className="rounded-md border bg-muted px-3 py-2 text-sm font-medium text-muted-foreground">
            {suffix}
          </div>
        ) : null}
      </div>
      {increments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {increments.map((amount) => (
            <Button
              key={amount}
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-3"
              onClick={() => handleIncrement(amount)}
              disabled={disabled}
            >
              +{amount}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange("")}
            disabled={disabled}
            className="text-muted-foreground"
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
};

TouchNumericField.displayName = "TouchNumericField";

export default TouchNumericField;
