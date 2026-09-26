import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MaskedDniInputProps = {
  value: string;
  onChange: (value: string) => void;
  revealed: boolean;
  onRevealedChange: (revealed: boolean) => void;
  placeholder?: string;
  className?: string;
};

// DNI field that stays masked (native `type="password"`, so it remains
// editable while hidden) until the user explicitly reveals it via the
// trailing eye toggle. Reveal state is owned by the caller so it can be
// reset per-row on removal, tab change, or dialog close.
export const MaskedDniInput = ({
  value,
  onChange,
  revealed,
  onRevealedChange,
  placeholder,
  className,
}: MaskedDniInputProps) => (
  <div className="relative">
    <Input
      type={revealed ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="off"
      inputMode="text"
      className={cn("pr-10", className)}
    />
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-0 top-0 h-full w-10 text-muted-foreground hover:text-foreground"
      onClick={() => onRevealedChange(!revealed)}
      aria-pressed={revealed}
      aria-label={revealed ? "Ocultar DNI" : "Mostrar DNI"}
    >
      {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </Button>
  </div>
);

export default MaskedDniInput;
