import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Plus, Trash2, Truck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  LOGISTICS_HOJA_CATEGORY_LABELS,
  LOGISTICS_HOJA_CATEGORY_MAX_SELECTION,
  LOGISTICS_HOJA_CATEGORY_OPTIONS,
  type LogisticsHojaCategory,
} from "@/constants/logisticsHojaCategories";
import { transportProviderToHojaCompany } from "@/constants/transportProviders";
import {
  driverDisplayName,
  type LogisticsMatrixData,
} from "@/features/logistics/fleet/fleetModel";
import { fetchLogisticsMatrix } from "@/features/logistics/fleet/fleetApi";
import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import { reportHojaError } from "@/features/hoja-de-ruta/lib/hojaLogger";
import type { Transport } from "@/types/hoja-de-ruta";

interface ModernTransportSectionProps {
  transport: Transport[];
  onUpdateTransport: (index: number, field: keyof Transport, value: unknown) => void;
  onAddTransport: () => void;
  onRemoveTransport: (index: number) => void;
  onImportTransports: (transports: Transport[]) => void;
  jobId?: string;
  headerControls?: React.ReactNode;
}

type LogisticsEventSnapshot = {
  id: string;
  event_date: string;
  event_time: string | null;
  end_date?: string | null;
  transport_type: unknown;
  license_plate: string | null;
  transport_provider: string | null;
  is_hoja_relevant: boolean | null;
  hoja_categories: unknown;
  updated_at: string | null;
};

const VALID_TRANSPORT_TYPES = [
  "trailer",
  "9m",
  "8m",
  "6m",
  "4m",
  "furgoneta",
  "sleeper_bus",
] as const;

const isValidTransportType = (type: unknown): type is Transport["transport_type"] =>
  typeof type === "string"
  && (VALID_TRANSPORT_TYPES as readonly string[]).includes(type);

const normalizeCategories = (categories: unknown): LogisticsHojaCategory[] => {
  if (!Array.isArray(categories)) return [];
  return categories.filter((category): category is LogisticsHojaCategory =>
    LOGISTICS_HOJA_CATEGORY_OPTIONS.includes(category as LogisticsHojaCategory)
  );
};

const uniqueJoined = (values: Array<string | null | undefined>): string | undefined => {
  const unique = Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
  return unique.length ? unique.join(" / ") : undefined;
};

const buildImportedTransports = (
  events: LogisticsEventSnapshot[],
  matrix: LogisticsMatrixData,
): Transport[] => {
  const matrixEvents = new Map(matrix.events.map((event) => [event.id, event]));
  const drivers = new Map(matrix.drivers.map((driver) => [driver.id, driver]));
  const vehicles = new Map(matrix.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const assignments = new Map<string, typeof matrix.assignments>();

  matrix.assignments
    .filter((assignment) => assignment.status !== "declined")
    .forEach((assignment) => {
      assignments.set(assignment.logistics_event_id, [
        ...(assignments.get(assignment.logistics_event_id) || []),
        assignment,
      ]);
    });

  return events.map((event): Transport => {
    const eventAssignments = assignments.get(event.id) || [];
    const assignedDrivers = eventAssignments
      .map((assignment) => assignment.driver_id ? drivers.get(assignment.driver_id) : undefined)
      .filter((driver): driver is NonNullable<typeof driver> => Boolean(driver));
    const assignedVehicles = eventAssignments
      .map((assignment) => assignment.vehicle_id ? vehicles.get(assignment.vehicle_id) : undefined)
      .filter((vehicle): vehicle is NonNullable<typeof vehicle> => Boolean(vehicle));
    const matrixEvent = matrixEvents.get(event.id);
    const time = event.event_time ? String(event.event_time).slice(0, 5) : "00:00";

    return {
      id: crypto.randomUUID(),
      transport_type: isValidTransportType(event.transport_type) ? event.transport_type : "trailer",
      driver_name: uniqueJoined(assignedDrivers.map(driverDisplayName)),
      // get_logistics_matrix only returns this for roles entitled to see driver phones.
      driver_phone: uniqueJoined(assignedDrivers.map((driver) => driver.phone)),
      license_plate: uniqueJoined([
        ...assignedVehicles.map((vehicle) => vehicle.license_plate),
        event.license_plate,
      ]),
      company: event.transport_provider
        ? transportProviderToHojaCompany(event.transport_provider)
        : assignedVehicles.length
          ? "sector-pro"
          : undefined,
      date_time: `${event.event_date}T${time}`,
      has_return: false,
      source_logistics_event_id: event.id,
      source_logistics_updated_at: event.updated_at || undefined,
      origin: matrixEvent?.origin || undefined,
      destination:
        matrixEvent?.destination
        || matrixEvent?.location_name
        || matrixEvent?.location_address
        || undefined,
      is_hoja_relevant: event.is_hoja_relevant ?? true,
      logistics_categories: normalizeCategories(event.hoja_categories),
    };
  });
};

export const ModernTransportSection: React.FC<ModernTransportSectionProps> = ({
  transport,
  onUpdateTransport,
  onAddTransport,
  onRemoveTransport,
  onImportTransports,
  jobId,
  headerControls,
}) => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [logisticsDriftCount, setLogisticsDriftCount] = useState(0);
  const validTransport = useMemo(
    () => (Array.isArray(transport) ? transport : []),
    [transport],
  );
  const transportRef = useRef(validTransport);
  const driftRunRef = useRef(0);
  transportRef.current = validTransport;

  const sourceFingerprint = useMemo(
    () => validTransport
      .filter((item) => item.source_logistics_event_id)
      .map((item) => `${item.source_logistics_event_id}:${item.source_logistics_updated_at || ""}`)
      .sort()
      .join("|"),
    [validTransport],
  );
  const sourceFingerprintRef = useRef(sourceFingerprint);
  sourceFingerprintRef.current = sourceFingerprint;

  const checkLogisticsDrift = useCallback(async () => {
    const run = ++driftRunRef.current;
    const requestedFingerprint = sourceFingerprint;
    if (!jobId) {
      setLogisticsDriftCount(0);
      return;
    }

    const { data, error } = await dataLayerClient
      .from("logistics_events")
      .select("id,updated_at,is_hoja_relevant")
      .eq("job_id", jobId);

    if (error) {
      reportHojaError("logistics.driftCheck", error);
      return;
    }
    if (
      run !== driftRunRef.current
      || requestedFingerprint !== sourceFingerprintRef.current
    ) return;

    const currentRows = (data || []) as Array<{
      id: string;
      updated_at: string | null;
      is_hoja_relevant: boolean | null;
    }>;
    const currentById = new Map(currentRows.map((row) => [row.id, row]));
    const sourced = transportRef.current.filter((item) => item.source_logistics_event_id);
    const sourcedIds = new Set(sourced.map((item) => item.source_logistics_event_id));
    const drifted = new Set<string>();

    sourced.forEach((item) => {
      const sourceId = item.source_logistics_event_id!;
      const current = currentById.get(sourceId);
      if (!current || current.is_hoja_relevant === false) {
        drifted.add(sourceId);
        return;
      }
      if (
        current.updated_at
        && (
          !item.source_logistics_updated_at
          || current.updated_at > item.source_logistics_updated_at
        )
      ) {
        drifted.add(sourceId);
      }
    });

    currentRows
      .filter((row) => row.is_hoja_relevant !== false && !sourcedIds.has(row.id))
      .forEach((row) => drifted.add(row.id));

    setLogisticsDriftCount(drifted.size);
  }, [jobId, sourceFingerprint]);

  useEffect(() => {
    void checkLogisticsDrift();
  }, [checkLogisticsDrift]);

  const toggleCategory = (index: number, category: LogisticsHojaCategory) => {
    const currentCategories = normalizeCategories(validTransport[index]?.logistics_categories);
    const hasCategory = currentCategories.includes(category);

    if (hasCategory) {
      onUpdateTransport(
        index,
        "logistics_categories",
        currentCategories.filter((item) => item !== category),
      );
      return;
    }

    if (currentCategories.length >= LOGISTICS_HOJA_CATEGORY_MAX_SELECTION) {
      toast({
        title: "Límite alcanzado",
        description: `Puedes seleccionar hasta ${LOGISTICS_HOJA_CATEGORY_MAX_SELECTION} categorías.`,
        variant: "destructive",
      });
      return;
    }

    onUpdateTransport(index, "logistics_categories", [...currentCategories, category]);
  };

  const handleImportFromLogistics = async () => {
    if (!jobId) {
      toast({
        title: "Error",
        description: "No hay un trabajo seleccionado",
        variant: "destructive",
      });
      return;
    }

    setIsImporting(true);
    try {
      const { data, error } = await dataLayerClient
        .from("logistics_events")
        .select("*")
        .eq("job_id", jobId)
        .eq("is_hoja_relevant", true)
        .order("event_date", { ascending: true })
        .order("event_time", { ascending: true });

      if (error) throw error;
      const logisticsEvents = (data || []) as unknown as LogisticsEventSnapshot[];

      if (!logisticsEvents.length) {
        onImportTransports([]);
        setLogisticsDriftCount(0);
        toast({
          title: "Sin datos",
          description: "No se encontraron eventos logísticos relevantes para este trabajo",
        });
        return;
      }

      const startKey = logisticsEvents
        .map((event) => event.event_date)
        .filter(Boolean)
        .sort()[0];
      const endKey = logisticsEvents
        .map((event) => event.end_date || event.event_date)
        .filter(Boolean)
        .sort()
        .at(-1) || startKey;
      let matrix: LogisticsMatrixData = {
        drivers: [],
        vehicles: [],
        events: [],
        assignments: [],
      };
      try {
        matrix = await fetchLogisticsMatrix(startKey, endKey);
      } catch (matrixError) {
        reportHojaError("logistics.matrix.fetch", matrixError);
      }
      const jobEventIds = new Set(logisticsEvents.map((event) => event.id));
      const jobMatrix: LogisticsMatrixData = {
        drivers: matrix.drivers,
        vehicles: matrix.vehicles,
        events: matrix.events.filter((event) => jobEventIds.has(event.id)),
        assignments: matrix.assignments.filter((assignment) =>
          jobEventIds.has(assignment.logistics_event_id)
        ),
      };

      const importedTransports = buildImportedTransports(logisticsEvents, jobMatrix);
      onImportTransports(importedTransports);
      setLogisticsDriftCount(0);

      toast({
        title: "Logística sincronizada",
        description: `Se sincronizaron ${importedTransports.length} transportes con conductores, flota y ubicaciones.`,
      });
    } catch (error) {
      reportHojaError("logistics.import", error);
      toast({
        title: "Error",
        description: "No se pudieron sincronizar los eventos logísticos",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="border">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Transporte
          </CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {headerControls}
            {jobId && (
              <Button
                onClick={handleImportFromLogistics}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={isImporting}
              >
                <Download className="w-4 h-4" />
                {isImporting ? "Sincronizando..." : "Sincronizar Logística"}
              </Button>
            )}
            <Button onClick={onAddTransport} size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" />
              Añadir Transporte
            </Button>
          </div>
        </div>
        {logisticsDriftCount > 0 && (
          <div
            role="status"
            className="mt-3 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {logisticsDriftCount} cambio{logisticsDriftCount === 1 ? "" : "s"} en Logística desde la última sincronización.
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleImportFromLogistics}
              disabled={isImporting}
            >
              Sincronizar
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <AnimatePresence>
            {validTransport.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="rounded-lg border border-border bg-card/70 p-6 backdrop-blur-sm"
              >
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">Transporte {index + 1}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveTransport(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Tipo de Transporte</Label>
                    <Select
                      value={item.transport_type}
                      onValueChange={(value) => onUpdateTransport(index, "transport_type", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trailer">Trailer</SelectItem>
                        <SelectItem value="9m">9m</SelectItem>
                        <SelectItem value="8m">8m</SelectItem>
                        <SelectItem value="6m">6m</SelectItem>
                        <SelectItem value="4m">4m</SelectItem>
                        <SelectItem value="furgoneta">Furgoneta</SelectItem>
                        <SelectItem value="sleeper_bus">Autobús cama</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Conductor</Label>
                    <Input
                      value={item.driver_name || ""}
                      onChange={(event) => onUpdateTransport(index, "driver_name", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono del Conductor</Label>
                    <Input
                      value={item.driver_phone || ""}
                      onChange={(event) => onUpdateTransport(index, "driver_phone", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input
                      value={item.license_plate || ""}
                      onChange={(event) => onUpdateTransport(index, "license_plate", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compañía</Label>
                    <Select
                      value={item.company}
                      onValueChange={(value) => onUpdateTransport(index, "company", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar compañía" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pantoja">Pantoja</SelectItem>
                        <SelectItem value="transluminaria">Transluminaria</SelectItem>
                        <SelectItem value="transcamarena">Transcamarena</SelectItem>
                        <SelectItem value="wild tour">Wild Tour</SelectItem>
                        <SelectItem value="camionaje">Camionaje</SelectItem>
                        <SelectItem value="sector-pro">Sector-Pro</SelectItem>
                        <SelectItem value="crespo">Crespo</SelectItem>
                        <SelectItem value="montabi_dorado">Montabi Dorado</SelectItem>
                        <SelectItem value="grupo_sese">Grupo Sesé</SelectItem>
                        <SelectItem value="nacex">Nacex</SelectItem>
                        <SelectItem value="montoya">Montoya</SelectItem>
                        <SelectItem value="recogida_cliente">Recogida Cliente</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha y Hora</Label>
                    <Input
                      type="datetime-local"
                      value={item.date_time || ""}
                      onChange={(event) => onUpdateTransport(index, "date_time", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Origen</Label>
                    <Input
                      value={item.origin || ""}
                      onChange={(event) => onUpdateTransport(index, "origin", event.target.value)}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Destino</Label>
                    <Input
                      value={item.destination || ""}
                      onChange={(event) => onUpdateTransport(index, "destination", event.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id={`has_return_${item.id}`}
                      checked={item.has_return || false}
                      onCheckedChange={(checked) => onUpdateTransport(index, "has_return", checked)}
                    />
                    <Label htmlFor={`has_return_${item.id}`}>Mismo camión para la vuelta</Label>
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id={`is_hoja_relevant_${item.id}`}
                      checked={item.is_hoja_relevant ?? true}
                      onCheckedChange={(checked) =>
                        onUpdateTransport(index, "is_hoja_relevant", checked === true)
                      }
                    />
                    <Label htmlFor={`is_hoja_relevant_${item.id}`}>Relevante Hoja de Ruta</Label>
                  </div>
                  <div className="space-y-2 md:col-span-2 lg:col-span-3">
                    <div className="flex items-center justify-between gap-3">
                      <Label>Categorías Hoja de Ruta</Label>
                      <span className="text-xs text-muted-foreground">
                        {normalizeCategories(item.logistics_categories).length}/{LOGISTICS_HOJA_CATEGORY_MAX_SELECTION}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {LOGISTICS_HOJA_CATEGORY_OPTIONS.map((category) => {
                        const selected = normalizeCategories(item.logistics_categories).includes(category);
                        return (
                          <Button
                            key={`${item.id}_${category}`}
                            type="button"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            disabled={item.is_hoja_relevant === false}
                            onClick={() => toggleCategory(index, category)}
                          >
                            {LOGISTICS_HOJA_CATEGORY_LABELS[category]}
                          </Button>
                        );
                      })}
                    </div>
                    {item.is_hoja_relevant === false && (
                      <p className="text-xs text-muted-foreground">
                        Activa "Relevante Hoja de Ruta" para usar categorías.
                      </p>
                    )}
                  </div>
                  {item.has_return && (
                    <div className="space-y-2">
                      <Label>Fecha y Hora de Vuelta</Label>
                      <Input
                        type="datetime-local"
                        value={item.return_date_time || ""}
                        onChange={(event) =>
                          onUpdateTransport(index, "return_date_time", event.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </CardContent>
    </Card>
  );
};
