import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveDriverDetails } from "@/features/logistics/fleet/fleetApi";
import {
  LICENSE_CATEGORIES,
  driverDisplayName,
  vehicleLabel,
  type FleetVehicle,
  type MatrixDriver,
} from "@/features/logistics/fleet/fleetModel";
import { getErrorMessage } from "@/utils/errorMessage";

const NONE = "none";

type DriverDetailsDialogProps = {
  driver: MatrixDriver | null;
  vehicles: FleetVehicle[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

export function DriverDetailsDialog({ driver, vehicles, onOpenChange, onSaved }: DriverDetailsDialogProps) {
  const { toast } = useToast();
  const [categories, setCategories] = useState<string[]>([]);
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [capExpiry, setCapExpiry] = useState("");
  const [adr, setAdr] = useState(false);
  const [defaultVehicleId, setDefaultVehicleId] = useState(NONE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!driver) return;
    setCategories(driver.license_categories);
    setLicenseExpiry(driver.license_expiry ?? "");
    setCapExpiry(driver.cap_expiry ?? "");
    setAdr(driver.adr_certified);
    setDefaultVehicleId(driver.default_vehicle_id ?? NONE);
    setNotes(driver.notes ?? "");
  }, [driver]);

  const toggleCategory = (category: string, checked: boolean) =>
    setCategories((current) => (checked ? [...current, category] : current.filter((item) => item !== category)));

  const submit = async () => {
    if (!driver) return;
    setSaving(true);
    try {
      await saveDriverDetails({
        profileId: driver.id,
        // Keep the canonical order so the stored array is stable.
        license_categories: LICENSE_CATEGORIES.filter((category) => categories.includes(category)),
        license_expiry: licenseExpiry || null,
        cap_expiry: capExpiry || null,
        adr_certified: adr,
        default_vehicle_id: defaultVehicleId === NONE ? null : defaultVehicleId,
        notes,
      });
      toast({ title: "Datos del conductor guardados" });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "No se pudieron guardar los datos", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(driver)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{driver ? driverDisplayName(driver) : "Conductor"}</DialogTitle>
          <DialogDescription>Permisos y documentación que se comprueban al asignarle un vehículo.</DialogDescription>
        </DialogHeader>
        <form
          id="driver-details-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Permisos de conducir</legend>
            <div className="flex flex-wrap gap-3">
              {LICENSE_CATEGORIES.map((category) => (
                <label key={category} className="flex items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={categories.includes(category)}
                    onCheckedChange={(checked) => toggleCategory(category, checked === true)}
                  />
                  {category}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="driver-license-expiry">Caducidad del permiso</Label>
              <Input id="driver-license-expiry" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="driver-cap-expiry">Caducidad del CAP</Label>
              <Input id="driver-cap-expiry" type="date" value={capExpiry} onChange={(e) => setCapExpiry(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={adr} onCheckedChange={(checked) => setAdr(checked === true)} />
            Certificado ADR (mercancías peligrosas)
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="driver-default-vehicle">Vehículo habitual</Label>
            <Select value={defaultVehicleId} onValueChange={setDefaultVehicleId}>
              <SelectTrigger id="driver-default-vehicle"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Ninguno</SelectItem>
                {vehicles.filter((vehicle) => vehicle.is_active || vehicle.id === defaultVehicleId).map((vehicle) => (
                  <SelectItem key={vehicle.id} value={vehicle.id}>{vehicleLabel(vehicle)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="driver-notes">Notas (visibles para el conductor)</Label>
            <Textarea id="driver-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="driver-details-form" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
