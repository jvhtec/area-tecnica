
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Map } from "lucide-react";
import { TourChips } from "@/components/dashboard/TourChips";
import { dataLayerClient } from "@/services/dataLayerClient";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileScreenHeader } from "@/components/mobile/MobileScreenHeader";

const Tours = () => {
  const [showTours, setShowTours] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { userRole } = useOptimizedAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // House techs have view-only access
  const readOnly = userRole === 'house_tech';

  // Fetch user data and preferences
  useEffect(() => {
    const fetchUserPrefs = async () => {
      const { data: { session } } = await dataLayerClient.auth.getSession();
      if (session?.user?.id) {
        setUserId(session.user.id);
        const { data, error } = await dataLayerClient.from("profiles")
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
      const { error } = await dataLayerClient.from("profiles")
        .update({ tours_expanded: newValue })
        .eq("id", userId);
      if (error) {
        console.error("Error updating tours preference:", error);
      }
    }
  };

  if (isMobile) {
    return (
      <div className="w-full space-y-4 px-3 py-4 pb-[calc(7rem+env(safe-area-inset-bottom))]">
        <MobileScreenHeader
          kicker="Planificación"
          title="Giras"
          subtitle={`${new Date().getFullYear()}`}
          accent="video"
          icon={Map}
          right={
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggleTours}
              className="h-10 w-10 rounded-full p-0 text-white hover:bg-white/15 hover:text-white"
              aria-label={showTours ? "Contraer giras" : "Expandir giras"}
            >
              {showTours ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </Button>
          }
        />
        {showTours && (
          <TourChips
            readOnly={readOnly}
            onTourClick={(tourId) => {
              navigate(`/tour-management/${tourId}`);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4 px-1 sm:px-6">
      <Card className="w-full bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30">
        <CardHeader className="flex flex-row items-center justify-between px-4 py-3 md:px-6 md:py-4">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg md:text-xl">
            Giras {new Date().getFullYear()}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleTours}
            className="h-8 w-8 p-0 shrink-0 touch-manipulation"
            aria-label={showTours ? "Contraer giras" : "Expandir giras"}
          >
            {showTours ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CardHeader>
        {showTours && (
          <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 md:px-6 md:pb-6">
            <TourChips
              readOnly={readOnly}
              onTourClick={(tourId) => {
                navigate(`/tour-management/${tourId}`);
              }}
            />
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default Tours;
