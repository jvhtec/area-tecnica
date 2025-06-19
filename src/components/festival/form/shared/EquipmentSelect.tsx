
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ model: string; quantity?: number }> | readonly string[];
  placeholder?: string;
  fallbackOptions?: readonly string[];
}

export const EquipmentSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select equipment",
  fallbackOptions = []
}: EquipmentSelectProps) => {
  // Determine if we have valid options to render
  const hasValidOptions = Array.isArray(options) && options.length > 0;
  // Use fallback options if provided options are empty
  const itemsToRender = hasValidOptions ? options : fallbackOptions;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Array.isArray(itemsToRender) && itemsToRender.length > 0 && 
          itemsToRender.map((option) => {
            if (typeof option === 'string') {
              return (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              );
            } else if (option && typeof option === 'object') {
              return (
                <SelectItem key={option.model} value={option.model}>
                  {option.model}{option.quantity ? ` (${option.quantity} available)` : ''}
                </SelectItem>
              );
            }
            return null;
          })
        }
      </SelectContent>
    </Select>
  );
};
