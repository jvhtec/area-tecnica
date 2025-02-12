
import { FestivalGearSetup } from "@/types/festival";

export const useEquipmentValidation = (gearSetup: FestivalGearSetup | null) => {
  const validateEquipment = (type: string, value: number): boolean => {
    if (!gearSetup) return true;
    
    switch (type) {
      case 'monitors':
        return value <= gearSetup.available_monitors;
      case 'cat6':
        return value <= gearSetup.available_cat6_runs;
      case 'hma':
        return value <= gearSetup.available_hma_runs;
      case 'coax':
        return value <= gearSetup.available_coax_runs;
      case 'opticalcon':
        return value <= gearSetup.available_opticalcon_duo_runs;
      case 'analog':
        return value <= gearSetup.available_analog_runs;
      default:
        return true;
    }
  };

  return { validateEquipment };
};
