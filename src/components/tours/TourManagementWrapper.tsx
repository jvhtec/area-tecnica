
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

  const { data: tour, isLoading, error } = useQuery({
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

      return data;
    },
    enabled: !!tourId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading tour management...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !tour) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Tour Not Found</h2>
              <p className="text-muted-foreground">
                {error?.message || "The requested tour could not be found."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <TourManagement tour={tour} />;
};
