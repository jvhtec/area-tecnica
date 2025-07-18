
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { TourChips } from "@/components/dashboard/TourChips";
import { supabase } from "@/lib/supabase";

const Tours = () => {
  const [showTours, setShowTours] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user data and preferences
  useEffect(() => {
    const fetchUserPrefs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data, error } = await supabase
          .from("profiles")
          .select("tours_expanded")
          .eq("id", session.user.id)
          .single();

        if (error) {
          console.error("Error fetching user preferences:", error);
          return;
        }

        if (data) {
          setShowTours(data.tours_expanded !== null && data.tours_expanded !== undefined ? data.tours_expanded : true);
        }
      }
    };

    fetchUserPrefs();
  }, []);

  const handleToggleTours = async () => {
    const newValue = !showTours;
    setShowTours(newValue);
    if (userId) {
      const { error } = await supabase
        .from("profiles")
        .update({ tours_expanded: newValue })
        .eq("id", userId);
      if (error) {
        console.error("Error updating tours preference:", error);
      }
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <Card className="w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Tours {new Date().getFullYear()}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleTours}
            className="h-8 w-8 p-0"
          >
            {showTours ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {showTours && (
          <CardContent>
            <TourChips
              onTourClick={(tourId) => {
                // This handles navigation to tour management
                console.log("Tour clicked:", tourId);
              }}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default Tours;
