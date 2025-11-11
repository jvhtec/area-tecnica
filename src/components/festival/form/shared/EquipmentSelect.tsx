
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ model: string; quantity?: number }> | readonly string[];
  placeholder?: string;
  fallbackOptions?: readonly string[];
  category?: string;
}

export const EquipmentSelect = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar equipo",
  fallbackOptions = [],
  category
}: EquipmentSelectProps) => {
  const { models, isLoading } = useEquipmentModels();
  
  // Filter models by category if provided
  const categoryModels = category 
    ? models.filter(model => model.category === category).map(model => model.name)
    : [];

  // Determine what options to use: database models, provided options, or fallback
  let itemsToRender: Array<{ model: string; quantity?: number }> | readonly string[] = [];
  
  if (category && categoryModels.length > 0) {
    // Use database models for this category
    itemsToRender = categoryModels;
  } else if (Array.isArray(options) && options.length > 0) {
    // Use provided options
    itemsToRender = options;
  } else {
    // Use fallback options
    itemsToRender = fallbackOptions;
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Cargando..." : placeholder} />
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
                  {option.model}{option.quantity ? ` (${option.quantity} disponibles)` : ''}
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
