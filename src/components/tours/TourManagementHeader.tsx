import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowLeft, Calendar, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface TourManagementHeaderProps {
  isTechnicianView: boolean;
  onBackToTechnicianDashboard: () => void;
  tour: {
    color?: string | null;
    description?: string | null;
    end_date?: string | null;
    name: string;
    start_date?: string | null;
  };
  tourLogoUrl?: string | null;
  totalAssignments: number;
  totalDates: number;
}

export const TourManagementHeader = ({
  isTechnicianView,
  onBackToTechnicianDashboard,
  tour,
  tourLogoUrl,
  totalAssignments,
  totalDates,
}: TourManagementHeaderProps) => (
  <div className="flex flex-col items-start gap-4 md:flex-row">
    {tourLogoUrl && (
      <div className="mx-auto flex-shrink-0 md:mx-0">
        <img
          src={tourLogoUrl}
          alt={`${tour.name} logo`}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          className="h-16 w-16 rounded-lg border border-border object-contain"
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      </div>
    )}
    <div className="flex-1 text-center md:text-left">
      {isTechnicianView && (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-2 md:justify-start">
          <Button variant="ghost" onClick={onBackToTechnicianDashboard} className="h-auto p-0">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver al Panel
          </Button>
          <Badge variant="outline">
            <Eye className="mr-1 h-3 w-3" />
            Vista de Técnico
          </Badge>
        </div>
      )}
      <h1 className="text-2xl font-bold md:text-3xl">{tour.name}</h1>
      {tour.description && (
        <p className="mt-1 text-sm text-muted-foreground md:text-base">{tour.description}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2 md:justify-start md:gap-4">
        {tour.start_date && tour.end_date && (
          <div className="flex items-center gap-2 text-xs md:text-sm">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(tour.start_date), "d MMM", { locale: es })} -{" "}
              {format(new Date(tour.end_date), "d MMM yyyy", { locale: es })}
            </span>
          </div>
        )}
        <Badge variant="outline" style={{ borderColor: tour.color ?? undefined, color: tour.color ?? undefined }}>
          {totalDates} fechas
        </Badge>
        {totalAssignments > 0 && <Badge variant="outline">{totalAssignments} personas asignadas</Badge>}
      </div>
    </div>
  </div>
);
