
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";

interface EquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ model: string; quantity?: number }> | readonly string[];
  placeholder?: string;
  fallbackOptions?: readonly string[];
  category?: string;
  disabled?: boolean;
}

type SelectOptionItem = { model: string; quantity?: number };

const toOptionItems = (
  input: Array<{ model: string; quantity?: number }> | readonly string[],
): SelectOptionItem[] =>
  input
    .map((option) =>
      typeof option === "string"
        ? { model: option.trim() }
        : { model: option.model?.trim() || "", quantity: option.quantity },
    )
    .filter((option) => option.model.length > 0);

const mergeUniqueByModel = (...lists: SelectOptionItem[][]): SelectOptionItem[] => {
  const seen = new Set<string>();
  const merged: SelectOptionItem[] = [];

  lists.forEach((list) => {
    list.forEach((item) => {
      const key = item.model.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(item);
    });
  });

  return merged;
};

export const EquipmentSelect = ({
  value,
  onChange,
  options,
  placeholder = "Seleccionar equipo",
  fallbackOptions = [],
  category,
  disabled = false,
}: EquipmentSelectProps) => {
  const { models, isLoading } = useEquipmentModels();

  const categoryItems: SelectOptionItem[] = category
    ? models
        .filter((model) => model.category === category)
        .map((model) => ({ model: model.name.trim() }))
        .filter((model) => model.model.length > 0)
    : [];
  const providedItems = toOptionItems(options);
  const fallbackItems = toOptionItems(fallbackOptions);
  const itemsToRender = mergeUniqueByModel(categoryItems, providedItems, fallbackItems);

  return (
    <Select value={value} onValueChange={onChange} disabled={isLoading || disabled}>
      <SelectTrigger>
        <SelectValue placeholder={isLoading ? "Cargando..." : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {itemsToRender.map((option) => (
          <SelectItem key={option.model} value={option.model}>
            {option.model}
            {option.quantity ? ` (${option.quantity} disponibles)` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
