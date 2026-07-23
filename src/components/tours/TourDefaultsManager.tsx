
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ResponsiveDialog, ResponsiveDialogContent, ResponsiveDialogHeader, ResponsiveDialogTitle } from "@/components/ui/responsive-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTourDefaultsPdfExports } from "@/features/tour-ops/useTourDefaultsPdfExports";
import { useToast } from "@/hooks/use-toast";
import { useTourDefaultSets, type TourDefaultTable } from "@/hooks/useTourDefaultSets";
import { useTourPowerDefaults } from "@/hooks/useTourPowerDefaults";
import { useTourWeightDefaults } from "@/hooks/useTourWeightDefaults";
import { queryKeys } from "@/lib/react-query";
import { dataLayerClient } from "@/services/dataLayerClient";
import { getTourDefaultDocumentNoUpdateToast, syncTourDefaultDocuments } from "@/utils/tourDefaultDocumentSync";
import {
  DEPARTMENT_PACKAGE_LABELS,
  TOUR_PACKAGE_LABELS,
  TOUR_PACKAGE_SIZES,
  getDepartmentPackageSize,
  getPackageBadgeLabel,
  isPackageDepartment,
  resolveDefaultSetForTourDate,
  type PackageDepartment,
  type TourPackageSize,
} from "@/utils/tourPackages";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Calendar, UploadCloud } from "lucide-react";
import React, { useState } from 'react';
import { TourDepartmentDefaults } from "./TourDepartmentDefaults";
import {
  getTourDateLocationName,
  isLegacyPowerDefault,
  isLegacyWeightDefault,
  isNewFormatTable,
  type CombinedDefaultType,
  type TourDateWithLocation,
  type TourDefaultsTour,
} from "./tourDefaultsManagerSupport";

interface TourDefaultsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tour: TourDefaultsTour;
}

export const TourDefaultsManager = ({
  open,
  onOpenChange,
  tour,
}: TourDefaultsManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('sound');
  const [tourDates, setTourDates] = useState<TourDateWithLocation[]>([]);
  const [newSetName, setNewSetName] = useState('');
  const [newSetDescription, setNewSetDescription] = useState('');
  const [newSetPackageSize, setNewSetPackageSize] = useState<TourPackageSize | null>(null);
  const [isSyncingDefaultDocs, setIsSyncingDefaultDocs] = useState(false);
  const defaultDocumentSyncQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  // Track the power default flag currently being toggled so only the affected
  // row/set is disabled (the shared mutation flag would otherwise freeze every
  // card).
  const [pendingFlagTableId, setPendingFlagTableId] = useState<string | null>(null);

  // Use the new tour default sets hook
  const {
    defaultSets,
    defaultTables,
    isLoading: defaultSetsLoading,
    createSet,
    updateSet,
    duplicateSet,
    deleteSet,
    deleteTable,
    isCreatingSet,
    isUpdatingSet,
    isDuplicatingSet,
    isDeletingSet,
    isDeletingTable
  } = useTourDefaultSets(tour?.id || '');

  // Keep the old hooks for backward compatibility but prioritize new system
  const {
    powerDefaults: legacyPowerDefaults,
    isLoading: soundPowerLoading,
    deleteDefault: deleteSoundPowerDefault
  } = useTourPowerDefaults(tour?.id || '');

  const {
    weightDefaults: legacyWeightDefaults,
    isLoading: soundWeightLoading,
    deleteDefault: deleteSoundWeightDefault
  } = useTourWeightDefaults(tour?.id || '');

  // Fetch tour dates
  React.useEffect(() => {
    const fetchTourDates = async () => {
      if (!tour?.id) return;
      
      const { data, error } = await dataLayerClient.from('tour_dates')
        .select(`
          id,
          date,
          tour_id,
          is_tour_pack_only,
          sound_package_size,
          lights_package_size,
          video_package_size,
          sound_default_set_id,
          lights_default_set_id,
          video_default_set_id,
          locations (
            name
          )
        `)
        .eq('tour_id', tour.id)
        .order('date', { ascending: true });

      if (error) {
        console.error('Error fetching tour dates:', error);
        return;
      }

      setTourDates((data || []) as TourDateWithLocation[]);
    };

    fetchTourDates();
  }, [tour?.id]);

  // Get defaults by department - prioritize new system, fallback to legacy
  const getDepartmentDefaults = (department: string, type: 'power' | 'weight'): CombinedDefaultType[] => {
    // First check if we have new format defaults
    const departmentSets = defaultSets.filter(set => set.department === department);
    const departmentTables = defaultTables.filter(table => 
      departmentSets.some(set => set.id === table.set_id) && table.table_type === type
    );

    if (departmentTables.length > 0) {
      return departmentTables;
    }

    // Fallback to legacy system
    if (type === 'power') {
      return legacyPowerDefaults.filter(d => d.department === department || (!d.department && department === 'sound'));
    } else {
      return legacyWeightDefaults.filter(d => d.department === department || (!d.department && department === 'sound'));
    }
  };

  const invalidateTourDocumentQueries = async () => {
    if (!tour?.id) return;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents', tour.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('jobcard-tour-documents') }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scope('tour-documents-for-job') }),
    ]);
  };

  const syncDefaultDocuments = async ({ silent = false }: { silent?: boolean } = {}) => {
    if (!tour?.id) return;

    const runSync = async () => {
      setIsSyncingDefaultDocs(true);
      try {
        const result = await syncTourDefaultDocuments({ tourId: tour.id });
        await invalidateTourDocumentQueries();

        if (result.errors.length > 0) {
          toast({
            title: 'PDFs sincronizados con avisos',
            description: `${result.errors.length} documento(s) no se pudieron refrescar.`,
            variant: 'destructive',
          });
        } else if (!silent) {
          toast(getTourDefaultDocumentNoUpdateToast(result) ?? {
            title: 'PDFs sincronizados',
            description: `${result.uploaded} documento(s) actualizados y ${result.removed} ruta(s) limpiadas.`,
          });
        }
      } catch (error) {
        console.error('Error syncing tour default documents:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron sincronizar los PDFs automáticos de fechas.',
          variant: 'destructive',
        });
      } finally {
        setIsSyncingDefaultDocs(false);
      }
    };

    const queuedSync = defaultDocumentSyncQueueRef.current.then(runSync, runSync);
    defaultDocumentSyncQueueRef.current = queuedSync.catch((): void => undefined);
    await queuedSync;
  };

  const updateSetAndSync = async ({
    setId,
    updates,
  }: Parameters<typeof updateSet>[0]) => {
    await updateSet({ setId, updates });
    await syncDefaultDocuments({ silent: true });
  };

  // Handle deletion based on format type
  const handleDeleteTable = async (table: CombinedDefaultType, type: 'power' | 'weight') => {
    try {
      // Check if this is new format (has table_data or set_id)
      if (isNewFormatTable(table)) {
        // New format - use deleteTable from useTourDefaultSets
        await deleteTable(table.id);
        await syncDefaultDocuments({ silent: true });
      } else {
        // Legacy format - use the old delete functions
        if (type === 'power' && isLegacyPowerDefault(table)) {
          await deleteSoundPowerDefault(table.id);
        } else if (type === 'weight' && isLegacyWeightDefault(table)) {
          await deleteSoundWeightDefault(table.id);
        }
      }
    } catch (error) {
      console.error('Error deleting table:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar la tabla',
        variant: 'destructive',
      });
    }
  };

  // Toggle a boolean flag (hoist / FOH schuko) on an already-saved power
  // default. These were previously only settable when the table was first
  // created in the Consumos tool, so a forgotten value could not be corrected.
  // Persisted directly (no per-toggle success toast) — the checkbox is the
  // feedback; only failures surface a toast.
  const handleTogglePowerFlag = async (
    table: TourDefaultTable,
    key: 'includes_hoist' | 'foh_schuko',
    value: boolean,
  ) => {
    const pendingKey = key === 'foh_schuko' ? `${key}:${table.set_id}` : table.id;
    setPendingFlagTableId(pendingKey);
    try {
      const tablesToUpdate =
        key === 'foh_schuko'
          ? defaultTables.filter(
              (candidate) =>
                candidate.set_id === table.set_id && candidate.table_type === 'power'
            )
          : [table];

      const results = await Promise.all(
        tablesToUpdate.map((candidate) =>
          dataLayerClient
            .from('tour_default_tables')
            .update({ metadata: { ...(candidate.metadata || {}), [key]: value } })
            .eq('id', candidate.id)
        )
      );
      const failedResult = results.find((result) => result.error);
      if (failedResult?.error) throw failedResult.error;

      await queryClient.invalidateQueries({
        queryKey: queryKeys.scope('tour-default-tables', tour?.id || ''),
      });
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error updating power default flag:', error);
      toast({
        title: 'Error',
        description: 'Error al actualizar la tabla',
        variant: 'destructive',
      });
    } finally {
      setPendingFlagTableId(null);
    }
  };

  // Handle set deletion
  const handleDeleteSet = async (setId: string) => {
    try {
      await deleteSet(setId);
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error deleting set:', error);
      toast({
        title: 'Error',
        description: 'Error al eliminar el conjunto',
        variant: 'destructive',
      });
    }
  };

  const handleCreateSet = async (department: string) => {
    if (!tour?.id || !isPackageDepartment(department)) return;
    const trimmedName = newSetName.trim();
    if (!trimmedName) {
      toast({
        title: 'Nombre requerido',
        description: 'Introduce un nombre para el conjunto.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createSet({
        tour_id: tour.id,
        name: trimmedName,
        description: newSetDescription.trim() || null,
        department,
        package_size: newSetPackageSize,
      });
      setNewSetName('');
      setNewSetDescription('');
      setNewSetPackageSize(null);
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error creating set:', error);
    }
  };

  const handleDuplicateSet = async (setId: string) => {
    const sourceSet = defaultSets.find((set) => set.id === setId);
    if (!sourceSet) return;

    try {
      await duplicateSet({
        setId,
        name: `${sourceSet.name} Copy`,
        description: sourceSet.description,
        package_size: sourceSet.package_size,
      });
      await syncDefaultDocuments({ silent: true });
    } catch (error) {
      console.error('Error duplicating set:', error);
    }
  };

  const updateSetPackageSize = async (setId: string, value: string) => {
    await updateSetAndSync({
      setId,
      updates: {
        package_size: value === 'unassigned' ? null : (value as TourPackageSize),
      },
    });
  };

  const getDuplicatePackageWarnings = (department: string) => {
    if (!isPackageDepartment(department)) return [];
    return TOUR_PACKAGE_SIZES.flatMap((packageSize) => {
      const matches = defaultSets.filter(
        (set) => set.department === department && set.package_size === packageSize
      );
      if (matches.length <= 1) return [];
      return [{
        packageSize,
        message: `Multiple ${DEPARTMENT_PACKAGE_LABELS[department]} ${TOUR_PACKAGE_LABELS[packageSize]} default sets exist. Date/package auto-resolution will be ambiguous unless a specific set is selected.`,
      }];
    });
  };

  const renderSetMetadata = (set: typeof defaultSets[number]) => {
    const packageSize = set.package_size || null;
    return (
      <div className="space-y-2 min-w-[220px]">
        <Input
          defaultValue={set.name}
          aria-label={`${set.name} set name`}
          onBlur={(event) => {
            const nextName = event.target.value.trim();
            if (nextName && nextName !== set.name) {
              void updateSetAndSync({ setId: set.id, updates: { name: nextName } });
            }
          }}
        />
        <Input
          defaultValue={set.description || ''}
          aria-label={`${set.name} set description`}
          placeholder="Description"
          onBlur={(event) => {
            const nextDescription = event.target.value.trim() || null;
            if (nextDescription !== (set.description || null)) {
              void updateSetAndSync({ setId: set.id, updates: { description: nextDescription } });
            }
          }}
        />
        <Select
          value={packageSize || 'unassigned'}
          onValueChange={(value) => void updateSetPackageSize(set.id, value)}
        >
          <SelectTrigger aria-label={`${set.name} package size`}>
            <SelectValue placeholder="Package size" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {TOUR_PACKAGE_SIZES.map((size) => (
              <SelectItem key={size} value={size}>
                {TOUR_PACKAGE_LABELS[size]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isPackageDepartment(set.department) && packageSize && (
          <Badge variant="outline">
            {getPackageBadgeLabel({ department: set.department, packageSize })}
          </Badge>
        )}
      </div>
    );
  };

  const {
    exportTourDatePDF,
    handleBulkPDFExport,
    handleBulkTourDateExport,
  } = useTourDefaultsPdfExports({
    defaultSets,
    defaultTables,
    getDepartmentDefaults,
    toast,
    tour,
    tourDates,
  });

  const renderDepartmentDefaults = (department: string) => (
    <TourDepartmentDefaults
      defaultSets={defaultSets}
      defaultTables={defaultTables}
      department={department}
      getDepartmentDefaults={getDepartmentDefaults}
      getDuplicatePackageWarnings={getDuplicatePackageWarnings}
      handleBulkPDFExport={handleBulkPDFExport}
      handleBulkTourDateExport={handleBulkTourDateExport}
      handleCreateSet={handleCreateSet}
      handleDeleteSet={handleDeleteSet}
      handleDeleteTable={handleDeleteTable}
      handleDuplicateSet={handleDuplicateSet}
      handleTogglePowerFlag={handleTogglePowerFlag}
      isCreatingSet={isCreatingSet}
      isDeletingSet={isDeletingSet}
      isDeletingTable={isDeletingTable}
      isDuplicatingSet={isDuplicatingSet}
      isUpdatingSet={isUpdatingSet}
      newSetDescription={newSetDescription}
      newSetName={newSetName}
      newSetPackageSize={newSetPackageSize}
      pendingFlagTableId={pendingFlagTableId}
      renderSetMetadata={renderSetMetadata}
      setNewSetDescription={setNewSetDescription}
      setNewSetName={setNewSetName}
      setNewSetPackageSize={setNewSetPackageSize}
      tourDates={tourDates}
    />
  );

  const renderTourDatesTab = () => {
    return (
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Fechas de Gira ({tourDates.length})
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncDefaultDocuments()}
              disabled={tourDates.length === 0 || isSyncingDefaultDocs}
            >
              <UploadCloud className="h-4 w-4 mr-1" />
              {isSyncingDefaultDocs ? 'Sincronizando...' : 'Sincronizar PDFs'}
            </Button>
          </div>
          <p className="text-sm text-green-700 mb-4">
            Exporta PDFs individuales para cada fecha de gira, incluyendo valores por defecto y anulaciones. Los PDFs automáticos se suben a documentos de gira y se reemplazan cuando cambian paquetes o valores por defecto.
          </p>
        </div>

        {tourDates.length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {tourDates.map((tourDate) => (
              <div key={tourDate.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">
                      {new Date(tourDate.date).toLocaleDateString('en-GB')}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {getTourDateLocationName(tourDate)}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(['sound', 'lights', 'video'] as PackageDepartment[]).map((department) => {
                        const packageSize = getDepartmentPackageSize(tourDate, department);
                        if (!packageSize) return null;
                        const resolution = resolveDefaultSetForTourDate({
                          tourDate,
                          department,
                          defaultSets,
                        });
                        return (
                          <Badge key={department} variant="outline" className="gap-1">
                            {getPackageBadgeLabel({ department, packageSize })}
                            {resolution.status !== 'resolved' && (
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                            )}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {['sound', 'lights', 'video'].map((dept) => (
                    <div key={dept} className="space-y-2">
                      <h5 className="text-sm font-medium capitalize">{dept}</h5>
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportTourDatePDF(tourDate, dept, 'power')}
                          className="text-xs"
                        >
                          PDF de Potencia
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => exportTourDatePDF(tourDate, dept, 'weight')}
                          className="text-xs"
                        >
                          PDF de Peso
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No hay fechas de gira configuradas</p>
        )}
      </div>
    );
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent className="max-w-5xl w-[95vw] md:w-full max-h-[calc(95vh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] md:max-h-[80vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-base md:text-lg truncate">Valores por Defecto de Gira: {tour?.name}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-2 gap-1 sm:h-10 sm:grid-cols-4 sm:gap-0">
            <TabsTrigger value="sound">Sonido</TabsTrigger>
            <TabsTrigger value="lights">Luces</TabsTrigger>
            <TabsTrigger value="video">Vídeo</TabsTrigger>
            <TabsTrigger value="tour-dates">Fechas de Gira</TabsTrigger>
          </TabsList>

          <TabsContent value="sound" className="mt-6">
            {defaultSetsLoading || soundPowerLoading || soundWeightLoading ? (
              <p>Cargando valores por defecto de sonido...</p>
            ) : (
              renderDepartmentDefaults('sound')
            )}
          </TabsContent>

          <TabsContent value="lights" className="mt-6">
            {defaultSetsLoading || soundPowerLoading || soundWeightLoading ? (
              <p>Cargando valores por defecto de luces...</p>
            ) : (
              renderDepartmentDefaults('lights')
            )}
          </TabsContent>

          <TabsContent value="video" className="mt-6">
            {defaultSetsLoading || soundPowerLoading || soundWeightLoading ? (
              <p>Cargando valores por defecto de vídeo...</p>
            ) : (
              renderDepartmentDefaults('video')
            )}
          </TabsContent>

          <TabsContent value="tour-dates" className="mt-6">
            {renderTourDatesTab()}
          </TabsContent>
        </Tabs>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
};
