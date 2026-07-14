
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';
import { useTourDateDefaultDocumentRefresh } from '@/hooks/useTourDateDefaultDocumentRefresh';
import {
  getPackageResolutionMessage,
  isPackageDepartment,
  resolveDefaultSetForTourDate,
  type ResolveDefaultSetResult,
  type TourDefaultSetLike,
  type TourPackageDateLike,
} from '@/utils/tourPackages';

type TourDefaultTableRow = Database['public']['Tables']['tour_default_tables']['Row'];
type TourDefaultTableData = {
  rows?: Array<{
    quantity: string;
    componentId: string;
    watts: string;
    weight: string;
    componentName?: string;
    lineName?: string;
    totalWatts?: number;
    totalWeight?: number;
    pf?: string;
    fixtureType?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};
type TourDefaultTableWithData = Omit<TourDefaultTableRow, 'table_data'> & {
  table_data: TourDefaultTableData;
};
type PowerOverrideRow = Database['public']['Tables']['tour_date_power_overrides']['Row'];
type WeightOverrideRow = Database['public']['Tables']['tour_date_weight_overrides']['Row'];
type PowerOverrideInsert = Database['public']['Tables']['tour_date_power_overrides']['Insert'];
type WeightOverrideInsert = Database['public']['Tables']['tour_date_weight_overrides']['Insert'];
type OverrideContextKey = 'tour_date_id' | 'department';
type OverrideSnapshotKey = 'override_data';
type OverrideInputPayload<TInsert> = Omit<TInsert, OverrideContextKey | OverrideSnapshotKey> & {
  override_data?: unknown;
};
type PowerOverrideInput = OverrideInputPayload<PowerOverrideInsert>;
type WeightOverrideInput = OverrideInputPayload<WeightOverrideInsert>;
type OverrideInput = PowerOverrideInput | WeightOverrideInput;
type TourOverrideRow = PowerOverrideRow | WeightOverrideRow;
type LocationJoin =
  | { name?: string | null }
  | Array<{ name?: string | null }>
  | null
  | undefined;

type TourDateWithLocation = TourPackageDateLike & {
  date: string;
  locations?: LocationJoin;
};

interface TourOverrideData {
  tourId: string;
  tourDateId: string;
  tourName: string;
  tourDate: string;
  locationName: string;
  defaults: TourDefaultTableWithData[];
  overrides: TourOverrideRow[];
  defaultSetResolution?: ResolveDefaultSetResult<TourDefaultSetLike>;
}

const getLocationName = (locations: LocationJoin): string => {
  const location = Array.isArray(locations) ? locations[0] : locations;
  return location?.name || 'Unknown Location';
};

export const useTourOverrideMode = (
  tourId?: string,
  tourDateId?: string,
  department?: string
) => {
  const [overrideData, setOverrideData] = useState<TourOverrideData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const refreshDefaultDocuments = useTourDateDefaultDocumentRefresh(tourDateId);

  const isOverrideMode = Boolean(tourId && tourDateId);

  useEffect(() => {
    if (!isOverrideMode || !department) return;

    const loadOverrideData = async () => {
      setIsLoading(true);
      try {
        // Fetch tour and tour date info
        const { data: tourData, error: tourError } = await supabase
          .from('tours')
          .select('name')
          .eq('id', tourId)
          .single();

        if (tourError) throw tourError;

        const { data: tourDateData, error: tourDateError } = await supabase
          .from('tour_dates')
          .select(`
            date,
            tour_id,
            is_tour_pack_only,
            sound_package_size,
            lights_package_size,
            video_package_size,
            sound_default_set_id,
            lights_default_set_id,
            video_default_set_id,
            locations (name)
          `)
          .eq('id', tourDateId)
          .single();

        if (tourDateError) throw tourDateError;

        const tourDate = tourDateData as TourDateWithLocation;
        let defaultTables: TourDefaultTableWithData[] = [];
        let defaultSetResolution: ResolveDefaultSetResult<TourDefaultSetLike> | undefined;

        if (isPackageDepartment(department)) {
          const { data: defaultSets, error: setsError } = await supabase
            .from('tour_default_sets')
            .select('*')
            .eq('tour_id', tourId)
            .eq('department', department);

          if (setsError) throw setsError;

          defaultSetResolution = resolveDefaultSetForTourDate({
            tourDate,
            department,
            defaultSets: (defaultSets || []) as TourDefaultSetLike[],
          });

          if (defaultSetResolution.status === 'resolved') {
            const { data, error: defaultsError } = await supabase
              .from('tour_default_tables')
              .select('*')
              .eq('set_id', defaultSetResolution.set.id);

            if (defaultsError) throw defaultsError;
            defaultTables = (data || []) as TourDefaultTableWithData[];
          } else {
            const message = getPackageResolutionMessage(defaultSetResolution);
            if (message) {
              toast({
                title: 'Tour defaults need attention',
                description: message,
                variant: 'destructive',
              });
            }
          }
        }

        // Fetch existing overrides for this tour date and department
        const powerOverridesPromise = supabase
          .from('tour_date_power_overrides')
          .select('*')
          .eq('tour_date_id', tourDateId)
          .eq('department', department);

        const weightOverridesPromise = supabase
          .from('tour_date_weight_overrides')
          .select('*')
          .eq('tour_date_id', tourDateId)
          .eq('department', department);

        const [powerOverrides, weightOverrides] = await Promise.all([
          powerOverridesPromise,
          weightOverridesPromise
        ]);

        setOverrideData({
          tourId,
          tourDateId,
          tourName: tourData.name,
          tourDate: tourDate.date,
          locationName: getLocationName(tourDate.locations),
          defaults: defaultTables,
          overrides: [
            ...((powerOverrides.data || []) as PowerOverrideRow[]),
            ...((weightOverrides.data || []) as WeightOverrideRow[])
          ],
          defaultSetResolution,
        });
      } catch (error) {
        console.error('Error loading override data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load tour override data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadOverrideData();
  }, [tourId, tourDateId, department, isOverrideMode, toast]);

  async function saveOverride(
    type: 'power',
    overrideData: PowerOverrideInput
  ): Promise<boolean | undefined>;
  async function saveOverride(
    type: 'weight',
    overrideData: WeightOverrideInput
  ): Promise<boolean | undefined>;
  async function saveOverride(
    type: 'power' | 'weight',
    overrideData: OverrideInput
  ): Promise<boolean | undefined> {
    if (!tourDateId || !department) return;

    try {
      const result = type === 'power'
        ? await supabase
          .from('tour_date_power_overrides')
          .insert({
            ...(overrideData as PowerOverrideInput),
            tour_date_id: tourDateId,
            department
          } as PowerOverrideInsert)
        : await supabase
          .from('tour_date_weight_overrides')
          .insert({
            ...(overrideData as WeightOverrideInput),
            tour_date_id: tourDateId,
            department
          } as WeightOverrideInsert);

      if (result.error) throw result.error;

      refreshDefaultDocuments();

      toast({
        title: 'Success',
        description: 'Override saved successfully',
      });

      return true;
    } catch (error) {
      console.error('Error saving override:', error);
      toast({
        title: 'Error',
        description: 'Failed to save override',
        variant: 'destructive',
      });
      return false;
    }
  }

  return {
    isOverrideMode,
    overrideData,
    isLoading,
    saveOverride,
  };
};
