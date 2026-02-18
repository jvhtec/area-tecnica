
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { QuantityInput } from "../shared/QuantityInput";
import { SectionProps } from "@/types/festival-form";
import { useEquipmentValidation } from "@/hooks/useEquipmentValidation";

export const MonitorSetupSection = ({ formData, onChange, gearSetup, isFieldLocked, language = "es" }: SectionProps) => {
  const { validateEquipment } = useEquipmentValidation(gearSetup);
  const locked = (field: string) => isFieldLocked?.(field) ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  return (
    <div className="space-y-4 border rounded-lg p-3 md:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h3 className="text-base md:text-lg font-semibold">{tx("Configuración de Monitores", "Monitor Setup")}</h3>
        <div className="flex items-center space-x-2">
          <Switch
            id="monitors-enabled"
            checked={formData.monitors_enabled}
            onCheckedChange={(checked) =>
              onChange({ monitors_enabled: checked, monitors_quantity: checked ? 1 : 0 })
            }
            disabled={locked("monitors_enabled")}
          />
          <Label htmlFor="monitors-enabled" className="text-sm md:text-base">{tx("Habilitar Monitores de Stage", "Enable Stage Monitors")}</Label>
        </div>
      </div>

      {formData.monitors_enabled && (
        <QuantityInput
          id="monitors-quantity"
          label={tx("Número de Monitores", "Monitor Count")}
          value={formData.monitors_quantity || 0}
          onChange={(value) => onChange({ monitors_quantity: value })}
          available={gearSetup?.available_monitors}
          validate={(value) => validateEquipment('monitors', value)}
          min={0}
          disabled={locked("monitors_quantity")}
          language={language}
        />
      )}
    </div>
  );
};
