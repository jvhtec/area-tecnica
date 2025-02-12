
import { ProviderSelector } from "../shared/ProviderSelector";
import { EquipmentSelect } from "../shared/EquipmentSelect";
import { QuantityInput } from "../shared/QuantityInput";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { SectionProps } from "@/types/festival-form";

const wirelessOptions = [
  'Shure AD Series', 'Shure AXT Series', 'Shure UR Series', 'Shure ULX Series',
  'Shure QLX Series', 'Sennheiser 2000 Series', 'Sennheiser EW500 Series',
  'Sennheiser EW300 Series', 'Sennheiser EW100 Series', 'Other'
];

const iemOptions = [
  'Shure Digital PSM Series', 'Shure PSM1000 Series', 'Shure PSM900 Series',
  'Shure PSM300 Series', 'Sennheiser 2000 series', 'Sennheiser 300 G4 Series',
  'Sennheiser 300 G3 Series', 'Wysicom MTK', 'Other'
];

export const WirelessSetupSection = ({ formData, onChange, gearSetup }: SectionProps) => {
  return (
    <div className="space-y-4 border rounded-lg p-4">
      <h3 className="text-lg font-semibold">RF & Wireless Setup</h3>
      <div className="grid grid-cols-2 gap-6">
        {/* Wireless Systems */}
        <div className="space-y-4">
          <ProviderSelector
            value={formData.wireless_provided_by}
            onChange={(value) => onChange({ wireless_provided_by: value })}
            label="Wireless Systems"
            id="wireless"
          />
          <EquipmentSelect
            value={formData.wireless_model}
            onChange={(value) => onChange({ wireless_model: value })}
            provider={formData.wireless_provided_by}
            festivalOptions={gearSetup?.wireless_systems}
            bandOptions={wirelessOptions}
            placeholder="Select wireless system"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wireless-hh">Handheld Qty</Label>
              <Input
                id="wireless-hh"
                type="number"
                min="0"
                value={formData.wireless_quantity_hh || 0}
                onChange={(e) => onChange({ 
                  wireless_quantity_hh: parseInt(e.target.value) || 0 
                })}
              />
            </div>
            <div>
              <Label htmlFor="wireless-bp">Bodypack Qty</Label>
              <Input
                id="wireless-bp"
                type="number"
                min="0"
                value={formData.wireless_quantity_bp || 0}
                onChange={(e) => onChange({ 
                  wireless_quantity_bp: parseInt(e.target.value) || 0 
                })}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="wireless-band">Frequency Band</Label>
            <Input
              id="wireless-band"
              value={formData.wireless_band || ''}
              onChange={(e) => onChange({ wireless_band: e.target.value })}
              placeholder="e.g., G50, H50"
            />
          </div>
        </div>

        {/* IEM Systems */}
        <div className="space-y-4">
          <ProviderSelector
            value={formData.iem_provided_by}
            onChange={(value) => onChange({ iem_provided_by: value })}
            label="IEM Systems"
            id="iem"
          />
          <EquipmentSelect
            value={formData.iem_model}
            onChange={(value) => onChange({ iem_model: value })}
            provider={formData.iem_provided_by}
            festivalOptions={gearSetup?.iem_systems}
            bandOptions={iemOptions}
            placeholder="Select IEM system"
          />
          <div>
            <Label htmlFor="iem-quantity">Quantity</Label>
            <Input
              id="iem-quantity"
              type="number"
              min="0"
              value={formData.iem_quantity || 0}
              onChange={(e) => onChange({ 
                iem_quantity: parseInt(e.target.value) || 0 
              })}
            />
          </div>
          <div>
            <Label htmlFor="iem-band">Frequency Band</Label>
            <Input
              id="iem-band"
              value={formData.iem_band || ''}
              onChange={(e) => onChange({ iem_band: e.target.value })}
              placeholder="e.g., G50, H50"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
