
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, User, Music } from "lucide-react";
import { useMyTours } from "@/hooks/useMyTours";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const MyToursSection = () => {
  const { activeTours, isLoading } = useMyTours();
  const navigate = useNavigate();

  const handleTourClick = (tourId: string) => {
    navigate(`/tour-management/${tourId}?mode=technician`);
  };

  const getDepartmentIcon = (department: string) => {
    switch (department.toLowerCase()) {
      case 'sound':
        return <Music className="h-4 w-4" />;
      case 'lights':
        return <Calendar className="h-4 w-4" />;
      case 'video':
        return <Calendar className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getDepartmentLabel = (department: string) => {
    switch (department.toLowerCase()) {
      case 'sound':
        return 'sonido';
      case 'lights':
        return 'luces';
      case 'video':
        return 'vídeo';
      default:
        return department;
    }
  };

  const formatUpcomingCount = (count: number) => {
    if (count === 1) return '1 fecha próxima';
    return `${count} fechas próximas`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mis giras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 dark:border-white mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">Cargando giras...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activeTours.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Mis giras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin giras activas</h3>
            <p className="text-muted-foreground">
              Actualmente no estás asignado a ninguna gira activa.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Mis giras
          <Badge variant="outline">{activeTours.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activeTours.map((tour) => (
            <Card 
              key={tour.id} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleTourClick(tour.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: tour.color }}
                    />
                    <h4 className="font-medium">{tour.name}</h4>
                  </div>
                  <Badge variant="outline">
                    {formatUpcomingCount(tour.upcoming_dates)}
                  </Badge>
                </div>
                {tour.description && (
                  <p className="text-sm text-muted-foreground">{tour.description}</p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    {getDepartmentIcon(tour.assignment_department)}
                    <span className="capitalize">{getDepartmentLabel(tour.assignment_department)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <User className="h-4 w-4" />
                    <span>{tour.assignment_role}</span>
                  </div>
                  {tour.start_date && tour.end_date && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {format(new Date(tour.start_date), "d 'de' MMM", { locale: es })} - {format(new Date(tour.end_date), "d 'de' MMM, yyyy", { locale: es })}
                      </span>
                    </div>
                  )}
                </div>
                {tour.assignment_notes && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    {tour.assignment_notes}
                  </p>
                )}
                <div className="mt-3">
                  <Button variant="outline" size="sm" className="w-full">
                    Ver detalles de la gira
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
