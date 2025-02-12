
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { QuantityInput } from "../shared/QuantityInput";
import { SectionProps } from "@/types/festival-form";
import { useEquipmentValidation } from "@/hooks/useEquipmentValidation";

export const MonitorSetupSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  const { validateEquipment } = useEquipmentValidation(gearSetup);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Monitor Setup</h3>
        <div className="flex items-center space-x-2">
          <Switch
            id="monitors-enabled"
            checked={formData.monitors_enabled}
            onCheckedChange={(checked) => 
              onChange({ monitors_enabled: checked, monitors_quantity: checked ? 1 : 0 })
            }
          />
          <Label htmlFor="monitors-enabled">Enable Stage Monitors</Label>
        </div>
      </div>

      {formData.monitors_enabled && (
        <QuantityInput
          id="monitors-quantity"
          label="Number of Monitors"
          value={formData.monitors_quantity || 0}
          onChange={(value) => onChange({ monitors_quantity: value })}
          available={gearSetup?.available_monitors}
          validate={(value) => validateEquipment('monitors', value)}
          min={0}
        />
      )}
    </div>
  );
};
