
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuantityInputProps } from "@/types/festival-form";

export const QuantityInput = ({
  value,
  onChange,
  label,
  id,
  available,
  validate,
  min = 0,
  className,
  disabled = false,
  language = "es",
}: QuantityInputProps) => {
  const tx = (es: string, en: string) => (language === "en" ? en : es);
  const isInvalid = validate ? !validate(value) : false;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2 items-center">
        <Input
          id={id}
          type="number"
          min={min}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 0)}
          disabled={disabled}
          className={cn(className, isInvalid && "border-red-500")}
        />
        {available !== undefined && (
          <Badge variant="secondary">
            {available} {tx("disponibles", "available")}
          </Badge>
        )}
      </div>
      {isInvalid && (
        <p className="text-sm text-red-500 flex items-center gap-1 mt-1">
          <AlertCircle className="h-4 w-4" />
          {tx("Excede la cantidad disponible", "Exceeds available quantity")}
        </p>
      )}
    </div>
  );
};
