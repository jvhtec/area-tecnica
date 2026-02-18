
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QuantityInput } from "../shared/QuantityInput";
import { SectionProps } from "@/types/festival-form";
import { useEquipmentValidation } from "@/hooks/useEquipmentValidation";

export const InfrastructureSection = ({ formData, onChange, gearSetup, isFieldLocked, language = "es" }: SectionProps) => {
  const { validateEquipment } = useEquipmentValidation(gearSetup);
  const locked = (field: string) => isFieldLocked?.(field) ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);

  return (
    <div className="space-y-4 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">{tx("Infraestructura", "Infrastructure")}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CAT6 */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                disabled={locked("infra_cat6")}
              />
              <Label htmlFor="infra-cat6" className="text-sm md:text-base">CAT6</Label>
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
                className="w-full sm:w-24"
                disabled={locked("infra_cat6_quantity")}
                language={language}
              />
            )}
          </div>
        </div>

        {/* HMA */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                disabled={locked("infra_hma")}
              />
              <Label htmlFor="infra-hma" className="text-sm md:text-base">HMA</Label>
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
                className="w-full sm:w-24"
                disabled={locked("infra_hma_quantity")}
                language={language}
              />
            )}
          </div>
        </div>

        {/* Coax */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                disabled={locked("infra_coax")}
              />
              <Label htmlFor="infra-coax" className="text-sm md:text-base">Coax</Label>
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
                className="w-full sm:w-24"
                disabled={locked("infra_coax_quantity")}
                language={language}
              />
            )}
          </div>
        </div>

        {/* OpticalCon Duo */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
                disabled={locked("infra_opticalcon_duo")}
              />
              <Label htmlFor="infra-opticalcon" className="text-sm md:text-base">OpticalCon Duo</Label>
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
                className="w-full sm:w-24"
                disabled={locked("infra_opticalcon_duo_quantity")}
                language={language}
              />
            )}
          </div>
        </div>

        {/* Analog Lines */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <Label htmlFor="infra-analog" className="text-sm md:text-base">{tx("Líneas Analógicas", "Analog Lines")}</Label>
            <QuantityInput
              id="infra-analog"
              label=""
              value={formData.infra_analog || 0}
              onChange={(value) => onChange({ infra_analog: value })}
              available={gearSetup?.available_analog_runs}
              validate={(value) => validateEquipment('analog', value)}
              min={0}
              className="w-full sm:w-24"
              disabled={locked("infra_analog")}
              language={language}
            />
          </div>
        </div>
      </div>

      <div>
        <Label htmlFor="other-infrastructure">{tx("Otros Requerimientos de Infraestructura", "Other Infrastructure Requirements")}</Label>
        <Input
          id="other-infrastructure"
          value={formData.other_infrastructure || ''}
          onChange={(e) => onChange({
            other_infrastructure: e.target.value
          })}
          placeholder={tx(
            "Ingrese cualquier requerimiento de infraestructura adicional",
            "Enter additional infrastructure requirements"
          )}
          disabled={locked("other_infrastructure")}
        />
      </div>
    </div>
  );
};
