
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface TourOverrideData {
  tourId: string;
  tourDateId: string;
  tourName: string;
  tourDate: string;
  locationName: string;
  defaults: any[];
  overrides: any[];
}

export const useTourOverrideMode = (
  tourId?: string,
  tourDateId?: string,
  department?: string
) => {
  const [overrideData, setOverrideData] = useState<TourOverrideData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

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
            locations (name)
          `)
          .eq('id', tourDateId)
          .single();

        if (tourDateError) throw tourDateError;

        // Fetch defaults for this tour and department
        const { data: defaultTables, error: defaultsError } = await supabase
          .from('tour_default_tables')
          .select(`
            *,
            tour_default_sets!inner(tour_id, department)
          `)
          .eq('tour_default_sets.tour_id', tourId)
          .eq('tour_default_sets.department', department);

        if (defaultsError) throw defaultsError;

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
          tourDate: tourDateData.date,
          locationName: (tourDateData.locations as any)?.name || 'Unknown Location',
          defaults: defaultTables || [],
          overrides: [
            ...(powerOverrides.data || []),
            ...(weightOverrides.data || [])
          ]
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

  const saveOverride = async (
    type: 'power' | 'weight',
    overrideData: any
  ) => {
    if (!tourDateId || !department) return;

    try {
      const tableName = type === 'power' 
        ? 'tour_date_power_overrides' 
        : 'tour_date_weight_overrides';

      const { error } = await supabase
        .from(tableName)
        .insert({
          tour_date_id: tourDateId,
          department,
          ...overrideData
        });

      if (error) throw error;

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
  };

  return {
    isOverrideMode,
    overrideData,
    isLoading,
    saveOverride,
  };
};
