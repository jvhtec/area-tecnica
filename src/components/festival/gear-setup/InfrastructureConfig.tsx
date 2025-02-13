
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
            value={data.available_cat6_runs}
            onChange={(e) => onChange({ available_cat6_runs: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="hma-runs">HMA Runs</Label>
          <Input
            id="hma-runs"
            type="number"
            min="0"
            value={data.available_hma_runs}
            onChange={(e) => onChange({ available_hma_runs: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="coax-runs">Coax Runs</Label>
          <Input
            id="coax-runs"
            type="number"
            min="0"
            value={data.available_coax_runs}
            onChange={(e) => onChange({ available_coax_runs: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="analog-runs">Analog Runs</Label>
          <Input
            id="analog-runs"
            type="number"
            min="0"
            value={data.available_analog_runs}
            onChange={(e) => onChange({ available_analog_runs: parseInt(e.target.value) || 0 })}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="opticalcon-runs">OpticalCon Duo Runs</Label>
          <Input
            id="opticalcon-runs"
            type="number"
            min="0"
            value={data.available_opticalcon_duo_runs}
            onChange={(e) => onChange({ available_opticalcon_duo_runs: parseInt(e.target.value) || 0 })}
          />
        </div>
      </div>
    </div>
  );
};
