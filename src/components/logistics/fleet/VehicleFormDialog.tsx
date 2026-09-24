import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { saveFleetVehicle, type FleetVehicleInput } from "@/features/logistics/fleet/fleetApi";
import {
  LICENSE_CATEGORIES,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  type FleetVehicle,
  type LicenseCategory,
  type VehicleType,
} from "@/features/logistics/fleet/fleetModel";
import { getErrorMessage } from "@/utils/errorMessage";

const emptyVehicle = (): FleetVehicleInput => ({
  id: null,
  name: "",
  license_plate: "",
  vehicle_type: "furgoneta",
  required_license: "B",
  brand: null,
  model: null,
  payload_kg: null,
  cargo_length_m: null,
  notes: null,
  is_active: true,
});

const toNumberOrNull = (value: string): number | null => {
  if (value.trim() === "") return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

type VehicleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: FleetVehicle | null;
  onSaved: () => void;
};

export function VehicleFormDialog({ open, onOpenChange, vehicle, onSaved }: VehicleFormDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState<FleetVehicleInput>(emptyVehicle);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(vehicle ? { ...vehicle } : emptyVehicle());
  }, [open, vehicle]);

  const update = <K extends keyof FleetVehicleInput>(key: K, value: FleetVehicleInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim() || !form.license_plate.trim()) {
      toast({ title: "Nombre y matrícula son obligatorios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveFleetVehicle(form);
      toast({ title: form.id ? "Vehículo actualizado" : "Vehículo añadido a la flota" });
      onSaved();
      onOpenChange(false);
    } catch (error) {
      toast({ title: "No se pudo guardar el vehículo", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar vehículo" : "Nuevo vehículo"}</DialogTitle>
        </DialogHeader>
        <form
          id="fleet-vehicle-form"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vehicle-name">Nombre</Label>
            <Input id="vehicle-name" value={form.name} maxLength={120} placeholder="Tráiler 1" onChange={(e) => update("name", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-plate">Matrícula</Label>
            <Input id="vehicle-plate" value={form.license_plate} maxLength={20} placeholder="1234 ABC" onChange={(e) => update("license_plate", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-type">Tipo</Label>
            <Select value={form.vehicle_type} onValueChange={(value) => update("vehicle_type", value as VehicleType)}>
              <SelectTrigger id="vehicle-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPES.map((type) => <SelectItem key={type} value={type}>{VEHICLE_TYPE_LABELS[type]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-license">Permiso necesario</Label>
            <Select value={form.required_license} onValueChange={(value) => update("required_license", value as LicenseCategory)}>
              <SelectTrigger id="vehicle-license"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LICENSE_CATEGORIES.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-brand">Marca</Label>
            <Input id="vehicle-brand" value={form.brand ?? ""} onChange={(e) => update("brand", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-model">Modelo</Label>
            <Input id="vehicle-model" value={form.model ?? ""} onChange={(e) => update("model", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-payload">Carga útil (kg)</Label>
            <Input id="vehicle-payload" inputMode="numeric" value={form.payload_kg ?? ""} onChange={(e) => update("payload_kg", toNumberOrNull(e.target.value))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-length">Longitud de caja (m)</Label>
            <Input id="vehicle-length" inputMode="decimal" value={form.cargo_length_m ?? ""} onChange={(e) => update("cargo_length_m", toNumberOrNull(e.target.value))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vehicle-notes">Notas</Label>
            <Textarea id="vehicle-notes" rows={2} value={form.notes ?? ""} onChange={(e) => update("notes", e.target.value || null)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="vehicle-active" checked={form.is_active} onCheckedChange={(checked) => update("is_active", checked)} />
            <Label htmlFor="vehicle-active">Disponible para asignar</Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" form="fleet-vehicle-form" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
