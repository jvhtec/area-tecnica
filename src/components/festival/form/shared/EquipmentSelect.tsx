
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  category?: string;
  placeholder?: string;
  fallbackOptions?: readonly string[];
}

export const EquipmentSelect = ({
  value,
  onChange,
  category,
  placeholder = "Select equipment",
  fallbackOptions = []
}: EquipmentSelectProps) => {
  const { data: models, isLoading } = useEquipmentModels(category);

  // Use database models if available, otherwise fallback to provided options
  const options = models && models.length > 0 
    ? models.map(model => model.name)
    : fallbackOptions;

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Loading..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
