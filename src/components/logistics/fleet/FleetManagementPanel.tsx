import { useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { deleteFleetVehicle } from "@/features/logistics/fleet/fleetApi";
import {
  driverDisplayName,
  vehicleLabel,
  vehicleTypeLabel,
  type FleetVehicle,
  type MatrixDriver,
} from "@/features/logistics/fleet/fleetModel";
import { useInvalidateLogisticsFleet, useLogisticsMatrix } from "@/features/logistics/fleet/useLogisticsFleet";
import { getErrorMessage } from "@/utils/errorMessage";
import { formatMadridDateKey } from "@/utils/timezoneUtils";

import { DriverDetailsDialog } from "./DriverDetailsDialog";
import { VehicleFormDialog } from "./VehicleFormDialog";

const isExpired = (dateKey: string | null, todayKey: string) => Boolean(dateKey && dateKey < todayKey);

export function FleetManagementPanel({ readOnly }: { readOnly: boolean }) {
  const { toast } = useToast();
  const invalidate = useInvalidateLogisticsFleet();
  const todayKey = formatMadridDateKey(new Date());
  // A one-day window is enough: the matrix read model always carries the whole
  // fleet and every driver alongside the day's assignments.
  const { data, isLoading } = useLogisticsMatrix(todayKey, todayKey);
  const [vehicleDialog, setVehicleDialog] = useState<{ vehicle: FleetVehicle | null } | null>(null);
  const [editingDriver, setEditingDriver] = useState<MatrixDriver | null>(null);
  const confirm = useConfirm();

  const vehicles = data?.vehicles ?? [];
  const drivers = data?.drivers ?? [];
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  const removeVehicle = async (vehicle: FleetVehicle) => {
    const confirmed = await confirm({
      title: "¿Eliminar vehículo?",
      description: `${vehicleLabel(vehicle)} se quitará de la flota. Si ya tiene asignaciones, desactívalo en su lugar.`,
      confirmText: "Eliminar",
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteFleetVehicle(vehicle.id);
      toast({ title: "Vehículo eliminado" });
      await invalidate();
    } catch (error) {
      toast({ title: "No se pudo eliminar", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <Card><CardContent className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-2">
      <Card className="min-w-0">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle>Vehículos</CardTitle>
            <CardDescription>Flota propia disponible en la matriz de conductores.</CardDescription>
          </div>
          {!readOnly && (
            <Button size="sm" onClick={() => setVehicleDialog({ vehicle: null })}>
              <Plus className="mr-1 h-4 w-4" /> Añadir vehículo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {vehicles.length === 0 ? (
            <p className="text-sm text-muted-foreground">Todavía no hay vehículos.</p>
          ) : (
            <ul className="divide-y">
              {vehicles.map((vehicle) => (
                <li key={vehicle.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {vehicle.name} <span className="font-normal text-muted-foreground">· {vehicle.license_plate}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {vehicleTypeLabel(vehicle.vehicle_type)} · Permiso {vehicle.required_license}
                      {vehicle.brand || vehicle.model ? ` · ${[vehicle.brand, vehicle.model].filter(Boolean).join(" ")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!vehicle.is_active && <Badge variant="secondary">Inactivo</Badge>}
                    {!readOnly && (
                      <>
                        <Button size="icon" variant="ghost" aria-label={`Editar ${vehicle.name}`} onClick={() => setVehicleDialog({ vehicle })}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" aria-label={`Eliminar ${vehicle.name}`} onClick={() => void removeVehicle(vehicle)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Conductores</CardTitle>
          <CardDescription>
            Usuarios con el rol «Conductor». Registra sus permisos para detectar asignaciones que no pueden cubrir.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay conductores. Asigna el rol «Conductor» a un usuario desde la gestión de usuarios.
            </p>
          ) : (
            <ul className="divide-y">
              {drivers.map((driver) => {
                const defaultVehicle = driver.default_vehicle_id ? vehiclesById.get(driver.default_vehicle_id) : null;
                return (
                  <li key={driver.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{driverDisplayName(driver)}</p>
                      <p className="text-muted-foreground">
                        {driver.license_categories.length > 0 ? `Permisos: ${driver.license_categories.join(", ")}` : "Sin permisos registrados"}
                        {driver.adr_certified ? " · ADR" : ""}
                        {defaultVehicle ? ` · ${vehicleLabel(defaultVehicle)}` : ""}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {isExpired(driver.license_expiry, todayKey) && <Badge variant="destructive">Permiso caducado</Badge>}
                        {isExpired(driver.cap_expiry, todayKey) && <Badge variant="destructive">CAP caducado</Badge>}
                      </div>
                    </div>
                    {!readOnly && (
                      <Button size="sm" variant="outline" onClick={() => setEditingDriver(driver)}>
                        <Pencil className="mr-1 h-4 w-4" /> Datos
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <VehicleFormDialog
        open={Boolean(vehicleDialog)}
        onOpenChange={(open) => { if (!open) setVehicleDialog(null); }}
        vehicle={vehicleDialog?.vehicle ?? null}
        onSaved={() => void invalidate()}
      />
      <DriverDetailsDialog
        driver={editingDriver}
        vehicles={vehicles}
        onOpenChange={(open) => { if (!open) setEditingDriver(null); }}
        onSaved={() => void invalidate()}
      />
    </div>
  );
}
