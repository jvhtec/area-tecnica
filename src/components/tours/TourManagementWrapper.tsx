
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import TourManagement from "@/pages/TourManagement";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export const TourManagementWrapper = () => {
  const { tourId } = useParams();
  const { user } = useOptimizedAuth();

  const {
    data: tourData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["tour", tourId],
    queryFn: async () => {
      if (!tourId) throw new Error("Tour ID is required");

      const { data, error } = await supabase
        .from("tours")
        .select(`
          *,
          tour_dates (
            *,
            location:locations (*)
          )
        `)
        .eq("id", tourId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Tour not found");

      const { data: jobData, error: jobError } = await supabase
        .from("jobs")
        .select("id")
        .eq("tour_id", tourId)
        .eq("job_type", "tour")
        .maybeSingle();

      if (jobError) throw jobError;

      return {
        tour: data,
        tourJobId: jobData?.id ?? null,
      };
    },
    enabled: !!tourId,
  });

  const tour = tourData?.tour;
  const tourJobId = tourData?.tourJobId ?? null;

  if (isLoading) {
    return (
      <div className="container mx-auto p-3 md:p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8 md:py-12 px-4">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm md:text-base">Loading tour management...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="container mx-auto p-3 md:p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8 md:py-12 px-4">
            <div className="text-center">
              <h2 className="text-lg md:text-xl font-semibold mb-2">Tour Not Found</h2>
              <p className="text-sm md:text-base text-muted-foreground">
                {error?.message || "The requested tour could not be found."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <TourManagement tour={tour} tourJobId={tourJobId} />;
};
