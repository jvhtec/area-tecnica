
import { WirelessSetup } from "./festival";

export interface WirelessConfigProps {
  systems: WirelessSetup[];
  onChange: (systems: WirelessSetup[]) => void;
  label: string;
  includeQuantityTypes?: boolean;
  isIEM?: boolean;
  defaultProvidedBy?: 'festival' | 'band';
}
