import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { Truck, Plus, Trash2, Download } from "lucide-react";
import { Transport } from "@/types/hoja-de-ruta";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  LOGISTICS_HOJA_CATEGORY_LABELS,
  LOGISTICS_HOJA_CATEGORY_MAX_SELECTION,
  LOGISTICS_HOJA_CATEGORY_OPTIONS,
  type LogisticsHojaCategory,
} from "@/constants/logisticsHojaCategories";

interface ModernTransportSectionProps {
  transport: Transport[];
  onUpdateTransport: (index: number, field: keyof Transport, value: any) => void;
  onAddTransport: () => void;
  onRemoveTransport: (index: number) => void;
  onImportTransports: (transports: Transport[]) => void;
  jobId?: string;  // Add jobId prop to fetch logistics events
}

export const ModernTransportSection: React.FC<ModernTransportSectionProps> = ({
  transport,
  onUpdateTransport,
  onAddTransport,
  onRemoveTransport,
  onImportTransports,
  jobId,
}) => {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);

  // Ensure transport is always an array
  const validTransport = Array.isArray(transport) ? transport : [];

  // Valid transport type values
  const VALID_TRANSPORT_TYPES = ['trailer', '9m', '8m', '6m', '4m', 'furgoneta'] as const;

  const isValidTransportType = (type: any): type is Transport['transport_type'] => {
    return VALID_TRANSPORT_TYPES.includes(type);
  };

  const normalizeCategories = (categories: unknown): LogisticsHojaCategory[] => {
    if (!Array.isArray(categories)) return [];
    return categories.filter((category): category is LogisticsHojaCategory =>
      LOGISTICS_HOJA_CATEGORY_OPTIONS.includes(category as LogisticsHojaCategory)
    );
  };

  const toggleCategory = (index: number, category: LogisticsHojaCategory) => {
    const currentCategories = normalizeCategories(validTransport[index]?.logistics_categories);
    const hasCategory = currentCategories.includes(category);

    if (hasCategory) {
      onUpdateTransport(
        index,
        "logistics_categories",
        currentCategories.filter((item) => item !== category)
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

  // Map transport_provider enum to company values (1:1 mapping)
  const mapProviderToCompany = (provider: string | null): Transport['company'] | undefined => {
    const mapping: Record<string, Transport['company']> = {
      'pantoja': 'pantoja',
      'transluminaria': 'transluminaria',
      'transcamarena': 'transcamarena',
      'the_wild_tour': 'wild tour',
      'camionaje': 'camionaje',
      'sector_pro': 'sector-pro',
      'crespo': 'crespo',
      'montabi_dorado': 'montabi_dorado',
      'grupo_sese': 'grupo_sese',
      'nacex': 'nacex',
      'recogida_cliente': 'recogida_cliente',
    };
    return provider ? mapping[provider] || 'other' : undefined;
  };

  // Import logistics events from database
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
      const { data: logisticsEvents, error } = await supabase
        .from('logistics_events')
        .select('*')
        .eq('job_id', jobId)
        .eq('is_hoja_relevant', true)
        .order('event_date', { ascending: true })
        .order('event_time', { ascending: true });

      if (error) throw error;

      if (!logisticsEvents || logisticsEvents.length === 0) {
        toast({
          title: "Sin datos",
          description: "No se encontraron eventos logísticos para este trabajo",
        });
        return;
      }

      // Map logistics events to Transport objects
      const importedTransports: Transport[] = logisticsEvents.map((event) => {
        // Combine event_date and event_time for datetime-local (no timezone conversion)
        const time = event.event_time ? String(event.event_time).slice(0, 5) : "00:00";
        const dateTime = `${event.event_date}T${time}`; // YYYY-MM-DDTHH:mm

        // Validate transport_type
        const transportType = event.transport_type;
        if (!isValidTransportType(transportType)) {
          console.warn(`Invalid transport_type: ${transportType}, defaulting to 'trailer'`);
        }

        return {
          id: crypto.randomUUID(),
          transport_type: isValidTransportType(transportType) ? transportType : 'trailer',
          license_plate: event.license_plate || undefined,
          company: mapProviderToCompany(event.transport_provider),
          date_time: dateTime,
          driver_name: undefined,
          driver_phone: undefined,
          has_return: false,
          return_date_time: undefined,
          source_logistics_event_id: event.id,
          is_hoja_relevant: event.is_hoja_relevant ?? true,
          logistics_categories: normalizeCategories((event as any).hoja_categories),
        };
      });

      // Use bulk import to avoid stale state issues
      onImportTransports(importedTransports);

      toast({
        title: "Importación exitosa",
        description: `Se importaron ${importedTransports.length} evento(s) logístico(s) relevante(s) para hoja de ruta`,
      });

    } catch (error) {
      console.error('Error importing logistics:', error);
      toast({
        title: "Error",
        description: "No se pudieron importar los eventos logísticos",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Card className="border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Transporte
          </CardTitle>
          <div className="flex gap-2">
            {jobId && (
              <Button
                onClick={handleImportFromLogistics}
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={isImporting}
              >
                <Download className="w-4 h-4" />
                {isImporting ? 'Importando...' : 'Importar desde Logística'}
              </Button>
            )}
            <Button
              onClick={onAddTransport}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir Transporte
            </Button>
          </div>
        </div>
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
                className="p-6 rounded-lg border border-border bg-card/70 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between mb-6">
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Transporte</Label>
                    <Select
                      value={item.transport_type}
                      onValueChange={(value) => onUpdateTransport(index, 'transport_type', value)}
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
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Nombre del Conductor</Label>
                    <Input
                      value={item.driver_name || ''}
                      onChange={(e) => onUpdateTransport(index, 'driver_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono del Conductor</Label>
                    <Input
                      value={item.driver_phone || ''}
                      onChange={(e) => onUpdateTransport(index, 'driver_phone', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Matrícula</Label>
                    <Input
                      value={item.license_plate || ''}
                      onChange={(e) => onUpdateTransport(index, 'license_plate', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Compañía</Label>
                    <Select
                      value={item.company}
                      onValueChange={(value) => onUpdateTransport(index, 'company', value)}
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
                        <SelectItem value="grupo_sese">Grupo Sese</SelectItem>
                        <SelectItem value="nacex">Nacex</SelectItem>
                        <SelectItem value="recogida_cliente">Recogida Cliente</SelectItem>
                        <SelectItem value="other">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha y Hora</Label>
                    <Input
                      type="datetime-local"
                      value={item.date_time || ''}
                      onChange={(e) => onUpdateTransport(index, 'date_time', e.target.value)}
                    />
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id={`has_return_${item.id}`}
                      checked={item.has_return || false}
                      onCheckedChange={(checked) => onUpdateTransport(index, 'has_return', checked)}
                    />
                    <Label htmlFor={`has_return_${item.id}`}>Mismo camión para la vuelta</Label>
                  </div>
                  <div className="flex items-center space-x-2 pt-6">
                    <Checkbox
                      id={`is_hoja_relevant_${item.id}`}
                      checked={item.is_hoja_relevant ?? true}
                      onCheckedChange={(checked) => onUpdateTransport(index, 'is_hoja_relevant', checked === true)}
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
                        value={item.return_date_time || ''}
                        onChange={(e) => onUpdateTransport(index, 'return_date_time', e.target.value)}
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
