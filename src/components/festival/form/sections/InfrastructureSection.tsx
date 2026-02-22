
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { QuantityInput } from "../shared/QuantityInput";
import { SectionProps } from "@/types/festival-form";
import { useEquipmentValidation } from "@/hooks/useEquipmentValidation";
import { useEffect } from "react";

interface InfrastructureSectionProps extends SectionProps {
  restrictToAvailable?: boolean;
}

export const InfrastructureSection = ({
  formData,
  onChange,
  gearSetup,
  isFieldLocked,
  language = "es",
  restrictToAvailable = false,
}: InfrastructureSectionProps) => {
  const { validateEquipment } = useEquipmentValidation(gearSetup);
  const locked = (field: string) => isFieldLocked?.(field) ?? false;
  const tx = (es: string, en: string) => (language === "en" ? en : es);
  const availableCat6 = (gearSetup?.available_cat6_runs ?? 0) > 0;
  const availableHma = (gearSetup?.available_hma_runs ?? 0) > 0;
  const availableCoax = (gearSetup?.available_coax_runs ?? 0) > 0;
  const availableOpticalcon = (gearSetup?.available_opticalcon_duo_runs ?? 0) > 0;
  const availableAnalog = (gearSetup?.available_analog_runs ?? 0) > 0;
  const showCat6 = !restrictToAvailable || availableCat6;
  const showHma = !restrictToAvailable || availableHma;
  const showCoax = !restrictToAvailable || availableCoax;
  const showOpticalcon = !restrictToAvailable || availableOpticalcon;
  const showAnalog = !restrictToAvailable || availableAnalog;
  const hasAnyInfrastructureOption = showCat6 || showHma || showCoax || showOpticalcon || showAnalog;

  useEffect(() => {
    if (!restrictToAvailable) return;

    const resetChanges: Partial<typeof formData> = {};

    if (!availableCat6 && (formData.infra_cat6 || (formData.infra_cat6_quantity || 0) > 0)) {
      resetChanges.infra_cat6 = false;
      resetChanges.infra_cat6_quantity = 0;
    }
    if (!availableHma && (formData.infra_hma || (formData.infra_hma_quantity || 0) > 0)) {
      resetChanges.infra_hma = false;
      resetChanges.infra_hma_quantity = 0;
    }
    if (!availableCoax && (formData.infra_coax || (formData.infra_coax_quantity || 0) > 0)) {
      resetChanges.infra_coax = false;
      resetChanges.infra_coax_quantity = 0;
    }
    if (!availableOpticalcon && (formData.infra_opticalcon_duo || (formData.infra_opticalcon_duo_quantity || 0) > 0)) {
      resetChanges.infra_opticalcon_duo = false;
      resetChanges.infra_opticalcon_duo_quantity = 0;
    }
    if (!availableAnalog && (formData.infra_analog || 0) > 0) {
      resetChanges.infra_analog = 0;
    }

    if (Object.keys(resetChanges).length > 0) {
      onChange(resetChanges);
    }
  }, [
    availableAnalog,
    availableCat6,
    availableCoax,
    availableHma,
    availableOpticalcon,
    formData,
    onChange,
    restrictToAvailable,
  ]);

  return (
    <div className="space-y-4 border rounded-lg p-3 md:p-4">
      <h3 className="text-base md:text-lg font-semibold">{tx("Infraestructura", "Infrastructure")}</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* CAT6 */}
        {showCat6 && (
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
        )}

        {/* HMA */}
        {showHma && (
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
        )}

        {/* Coax */}
        {showCoax && (
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
        )}

        {/* OpticalCon Duo */}
        {showOpticalcon && (
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
        )}

        {/* Analog Lines */}
        {showAnalog && (
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
        )}
      </div>

      {!hasAnyInfrastructureOption && restrictToAvailable && (
        <p className="text-sm text-muted-foreground">
          {tx(
            "No hay opciones de infraestructura disponibles en la dotación de festival para este formulario.",
            "There are no infrastructure options available in the festival allocation for this form."
          )}
        </p>
      )}

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
