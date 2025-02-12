
import { ProviderSelector } from "../shared/ProviderSelector";
import { EquipmentSelect } from "../shared/EquipmentSelect";
import { SectionProps } from "@/types/festival-form";

const consoleOptions = [
  'Yamaha CL5', 'Yamaha PMx', 'DiGiCo SD5', 'DiGiCo SD7', 'DiGiCo SD8', 
  'DiGiCo SD10', 'DiGiCo SD11', 'DiGiCo SD12', 'DiGiCo SD5Q', 'DiGiCo SD7Q',
  'DiGiCo Q225', 'DiGiCo Q326', 'DiGiCo Q338', 'DiGiCo Q852', 'Avid S6L',
  'A&H C1500', 'A&H C2500', 'A&H S3000', 'A&H S5000', 'A&H S7000',
  'Waves LV1 (homemade)', 'Waves LV1 Classic', 'SSL', 'Other'
];

export const ConsoleSetupSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">Console Setup</h3>
      <div className="grid grid-cols-2 gap-6">
        {/* FOH Console */}
        <div className="space-y-4">
          <ProviderSelector
            value={formData.foh_console_provided_by}
            onChange={(value) => onChange({ foh_console_provided_by: value })}
            label="FOH Console"
            id="foh"
          />
          <EquipmentSelect
            value={formData.foh_console}
            onChange={(value) => onChange({ foh_console: value })}
            provider={formData.foh_console_provided_by}
            festivalOptions={gearSetup?.foh_consoles}
            bandOptions={consoleOptions}
            placeholder="Select console"
          />
        </div>

        {/* Monitor Console */}
        <div className="space-y-4">
          <ProviderSelector
            value={formData.mon_console_provided_by}
            onChange={(value) => onChange({ mon_console_provided_by: value })}
            label="Monitor Console"
            id="mon"
          />
          <EquipmentSelect
            value={formData.mon_console}
            onChange={(value) => onChange({ mon_console: value })}
            provider={formData.mon_console_provided_by}
            festivalOptions={gearSetup?.mon_consoles}
            bandOptions={consoleOptions}
            placeholder="Select console"
          />
        </div>
      </div>
    </div>
  );
};
