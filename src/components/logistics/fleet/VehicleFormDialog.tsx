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
  parseBerthLayouts,
  type FleetVehicle,
  suggestedLicenseForVehicleType,
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
  has_tail_lift: false,
  itv_expiry: null,
  insurance_expiry: null,
  notes: null,
  is_active: true,
  berth_layouts: [],
});

/** Blank → null, a valid non-negative number → the number, anything else → undefined (invalid). */
const parseOptionalNumber = (value: string): number | null | undefined => {
  if (value.trim() === "") return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

const numberText = (value: number | null) => (value === null ? "" : String(value));

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
  // Numeric inputs keep their raw text so intermediate values like "13." stay editable;
  // they are parsed only on submit.
  const [payloadText, setPayloadText] = useState("");
  const [lengthText, setLengthText] = useState("");
  const [berthsText, setBerthsText] = useState("");

  useEffect(() => {
    if (!open) return;
    const initial = vehicle ? { ...vehicle } : emptyVehicle();
    setForm(initial);
    setPayloadText(numberText(initial.payload_kg));
    setLengthText(numberText(initial.cargo_length_m));
    setBerthsText(initial.berth_layouts.join(", "));
  }, [open, vehicle]);

  const update = <K extends keyof FleetVehicleInput>(key: K, value: FleetVehicleInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.name.trim() || !form.license_plate.trim()) {
      toast({ title: "Nombre y matrícula son obligatorios", variant: "destructive" });
      return;
    }
    const payloadKg = parseOptionalNumber(payloadText);
    if (payloadKg === undefined || (payloadKg !== null && !Number.isInteger(payloadKg))) {
      toast({ title: "La carga útil debe ser un número entero de kilos", variant: "destructive" });
      return;
    }
    const cargoLengthM = parseOptionalNumber(lengthText);
    if (cargoLengthM === undefined) {
      toast({ title: "La longitud de caja debe ser un número", variant: "destructive" });
      return;
    }
    const berths = form.vehicle_type === "sleeper_bus" ? parseBerthLayouts(berthsText) : { layouts: [] };
    if ("error" in berths) {
      toast({ title: "Literas no válidas", description: berths.error, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await saveFleetVehicle({ ...form, payload_kg: payloadKg, cargo_length_m: cargoLengthM, berth_layouts: berths.layouts });
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
            <Select
              value={form.vehicle_type}
              onValueChange={(value) => {
                const type = value as VehicleType;
                setForm((current) => ({
                  ...current,
                  vehicle_type: type,
                  required_license: suggestedLicenseForVehicleType(type, current.required_license),
                }));
              }}
            >
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
          {form.vehicle_type === "sleeper_bus" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="vehicle-berths">Literas</Label>
              <Input
                id="vehicle-berths"
                inputMode="numeric"
                placeholder="20, o 16, 18, 20 si se puede reconfigurar"
                value={berthsText}
                onChange={(e) => setBerthsText(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Una cifra por configuración de literas. Se usa para sugerir el autobús según el personal del trabajo.
              </p>
            </div>
          )}
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
            <Input id="vehicle-payload" inputMode="numeric" value={payloadText} onChange={(e) => setPayloadText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-length">Longitud de caja (m)</Label>
            <Input id="vehicle-length" inputMode="decimal" value={lengthText} onChange={(e) => setLengthText(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-itv">Caducidad de la ITV</Label>
            <Input id="vehicle-itv" type="date" value={form.itv_expiry ?? ""} onChange={(e) => update("itv_expiry", e.target.value || null)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vehicle-insurance">Caducidad del seguro</Label>
            <Input id="vehicle-insurance" type="date" value={form.insurance_expiry ?? ""} onChange={(e) => update("insurance_expiry", e.target.value || null)} />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Switch id="vehicle-tail-lift" checked={form.has_tail_lift} onCheckedChange={(checked) => update("has_tail_lift", checked)} />
            <Label htmlFor="vehicle-tail-lift">Plataforma elevadora</Label>
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
