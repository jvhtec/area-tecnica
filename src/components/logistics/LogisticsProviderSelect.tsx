import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TRANSPORT_PROVIDERS, type TransportProvider } from "@/constants/transportProviders";

const OWN = "own";

/** Company handling the transport; empty means our own vehicle and driver. */
export function LogisticsProviderSelect({
  value,
  onChange,
}: {
  value: TransportProvider | null;
  onChange: (value: TransportProvider | null) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor="logistics-transport-provider">Empresa de transporte</Label>
      <Select
        value={value ?? OWN}
        onValueChange={(next) => onChange(next === OWN ? null : (next as TransportProvider))}
      >
        <SelectTrigger id="logistics-transport-provider">
          <SelectValue placeholder="Selecciona empresa…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={OWN}>Sin empresa externa</SelectItem>
          {Object.entries(TRANSPORT_PROVIDERS).map(([key, { label }]) => (
            <SelectItem key={key} value={key}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
