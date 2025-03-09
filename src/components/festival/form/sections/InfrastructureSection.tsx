
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QuantityInput } from "../shared/QuantityInput";
import { SectionProps } from "@/types/festival-form";
import { useEquipmentValidation } from "@/hooks/useEquipmentValidation";

export const InfrastructureSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  const { validateEquipment } = useEquipmentValidation(gearSetup);

  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Infrastructure</h3>

      <div className="grid grid-cols-2 gap-4">
        {/* CAT6 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="infra-cat6"
                checked={formData.infra_cat6}
                onCheckedChange={(checked) => 
                  onChange({
                    infra_cat6: checked,
                    infra_cat6_quantity: checked ? 1 : 0
                  })
                }
              />
              <Label htmlFor="infra-cat6">CAT6</Label>
            </div>
            {formData.infra_cat6 && (
              <QuantityInput
                id="infra-cat6-qty"
                label=""
                value={formData.infra_cat6_quantity || 0}
                onChange={(value) => onChange({ infra_cat6_quantity: value })}
                available={gearSetup?.available_cat6_runs}
                validate={(value) => validateEquipment('cat6', value)}
                min={1}
                className="w-24"
              />
            )}
          </div>
        </div>

        {/* HMA */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="infra-hma"
                checked={formData.infra_hma}
                onCheckedChange={(checked) => 
                  onChange({
                    infra_hma: checked,
                    infra_hma_quantity: checked ? 1 : 0
                  })
                }
              />
              <Label htmlFor="infra-hma">HMA</Label>
            </div>
            {formData.infra_hma && (
              <QuantityInput
                id="infra-hma-qty"
                label=""
                value={formData.infra_hma_quantity || 0}
                onChange={(value) => onChange({ infra_hma_quantity: value })}
                available={gearSetup?.available_hma_runs}
                validate={(value) => validateEquipment('hma', value)}
                min={1}
                className="w-24"
              />
            )}
          </div>
        </div>

        {/* Coax */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="infra-coax"
                checked={formData.infra_coax}
                onCheckedChange={(checked) => 
                  onChange({
                    infra_coax: checked,
                    infra_coax_quantity: checked ? 1 : 0
                  })
                }
              />
              <Label htmlFor="infra-coax">Coax</Label>
            </div>
            {formData.infra_coax && (
              <QuantityInput
                id="infra-coax-qty"
                label=""
                value={formData.infra_coax_quantity || 0}
                onChange={(value) => onChange({ infra_coax_quantity: value })}
                available={gearSetup?.available_coax_runs}
                validate={(value) => validateEquipment('coax', value)}
                min={1}
                className="w-24"
              />
            )}
          </div>
        </div>

        {/* OpticalCon Duo */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="infra-opticalcon"
                checked={formData.infra_opticalcon_duo}
                onCheckedChange={(checked) => 
                  onChange({
                    infra_opticalcon_duo: checked,
                    infra_opticalcon_duo_quantity: checked ? 1 : 0
                  })
                }
              />
              <Label htmlFor="infra-opticalcon">OpticalCon Duo</Label>
            </div>
            {formData.infra_opticalcon_duo && (
              <QuantityInput
                id="infra-opticalcon-qty"
                label=""
                value={formData.infra_opticalcon_duo_quantity || 0}
                onChange={(value) => onChange({ infra_opticalcon_duo_quantity: value })}
                available={gearSetup?.available_opticalcon_duo_runs}
                validate={(value) => validateEquipment('opticalcon', value)}
                min={1}
                className="w-24"
              />
            )}
          </div>
        </div>

        {/* Analog Lines */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="infra-analog">Analog Lines</Label>
            <QuantityInput
              id="infra-analog"
              label=""
              value={formData.infra_analog || 0}
              onChange={(value) => onChange({ infra_analog: value })}
              available={gearSetup?.available_analog_runs}
              validate={(value) => validateEquipment('analog', value)}
              min={0}
              className="w-24"
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="other-infrastructure">Other Infrastructure Requirements</Label>
        <Input
          id="other-infrastructure"
          value={formData.other_infrastructure || ''}
          onChange={(e) => onChange({
            other_infrastructure: e.target.value
          })}
          placeholder="Enter any additional infrastructure requirements"
        />
      </div>
    </div>
  );
};
