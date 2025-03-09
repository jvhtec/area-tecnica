
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ model: string; quantity?: number }> | readonly string[];
  placeholder?: string;
}

export const EquipmentSelect = ({
  value,
  onChange,
  options,
  placeholder = "Select equipment"
}: EquipmentSelectProps) => {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {Array.isArray(options) && options.length > 0 && 
          options.map((option) => {
            if (typeof option === 'string') {
              return (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              );
            } else {
              return (
                <SelectItem key={option.model} value={option.model}>
                  {option.model}{option.quantity ? ` (${option.quantity} available)` : ''}
                </SelectItem>
              );
            }
          })
        }
      </SelectContent>
    </Select>
  );
};
