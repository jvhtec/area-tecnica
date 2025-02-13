
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InfrastructureConfigProps } from "@/types/festival-gear";

export const InfrastructureConfig = ({ data, onChange }: InfrastructureConfigProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Infrastructure</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cat6-runs">CAT6 Runs</Label>
          <Input
            id="cat6-runs"
            type="number"
            min="0"
            value={data.infra_cat6_quantity}
            onChange={(e) => onChange({ infra_cat6_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hma-runs">HMA Runs</Label>
          <Input
            id="hma-runs"
            type="number"
            min="0"
            value={data.infra_hma_quantity}
            onChange={(e) => onChange({ infra_hma_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="coax-runs">Coax Runs</Label>
          <Input
            id="coax-runs"
            type="number"
            min="0"
            value={data.infra_coax_quantity}
            onChange={(e) => onChange({ infra_coax_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="analog-runs">Analog Runs</Label>
          <Input
            id="analog-runs"
            type="number"
            min="0"
            value={data.infra_analog}
            onChange={(e) => onChange({ infra_analog: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="opticalcon-runs">OpticalCon Duo Runs</Label>
          <Input
            id="opticalcon-runs"
            type="number"
            min="0"
            value={data.infra_opticalcon_duo_quantity}
            onChange={(e) => onChange({ infra_opticalcon_duo_quantity: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
};
