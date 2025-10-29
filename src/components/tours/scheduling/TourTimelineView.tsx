import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  MapPin,
  Clock,
  Download,
  CloudSun,
  Route,
  Users,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TourTimelineViewProps {
  tourData: any;
  tourDates: any[];
  onDateSelect: (dateId: string) => void;
  selectedDateId: string | null;
  canEdit: boolean;
  onGenerateDaySheet: (dateId: string) => void;
}

export const TourTimelineView: React.FC<TourTimelineViewProps> = ({
  tourData,
  tourDates,
  onDateSelect,
  selectedDateId,
  canEdit,
  onGenerateDaySheet,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [view, setView] = useState<'calendar' | 'list'>('list');

  // Sort tour dates
  const sortedDates = [...tourDates].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Get calendar days for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get tour dates map for quick lookup
  const tourDatesMap = new Map(
    sortedDates.map(td => [format(new Date(td.date), 'yyyy-MM-dd'), td])
  );

  const handlePreviousMonth = () => {
    setCurrentMonth(prev => addDays(startOfMonth(prev), -1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => addDays(endOfMonth(prev), 1));
  };

  const handleDateClick = (tourDate: any) => {
    onDateSelect(tourDate.id);
  };

  const getSelectedDate = () => {
    return sortedDates.find(d => d.id === selectedDateId);
  };

  const selectedDate = getSelectedDate();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
      {/* Timeline / Calendar View */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Timeline del Tour
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant={view === 'list' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('list')}
                >
                  Lista
                </Button>
                <Button
                  variant={view === 'calendar' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setView('calendar')}
                >
                  Calendario
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === 'list' ? (
              <ScrollArea className="h-[500px] pr-4">
                <div className="space-y-3">
                  {sortedDates.map((tourDate, index) => {
                    const isSelected = selectedDateId === tourDate.id;
                    const prevDate = index > 0 ? sortedDates[index - 1] : null;
                    const travelDays = prevDate
                      ? Math.ceil(
                          (new Date(tourDate.date).getTime() - new Date(prevDate.date).getTime()) /
                            (1000 * 60 * 60 * 24)
                        ) - 1
                      : 0;

                    return (
                      <div key={tourDate.id}>
                        {/* Travel time indicator for back-to-back dates */}
                        {travelDays > 0 && (
                          <div className="flex items-center gap-2 my-2 ml-4 text-sm text-muted-foreground">
                            <Route className="h-4 w-4" />
                            <span>{travelDays} día(s) de viaje</span>
                          </div>
                        )}

                        <Card
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            isSelected && "ring-2 ring-primary"
                          )}
                          onClick={() => handleDateClick(tourDate)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-4 w-4 text-primary" />
                                  <span className="font-semibold">
                                    {format(new Date(tourDate.date), "EEEE, d 'de' MMMM yyyy", {
                                      locale: es,
                                    })}
                                  </span>
                                  <Badge variant="outline">Día {index + 1}</Badge>
                                </div>
                                {tourDate.location && (
                                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                    <span>{tourDate.location.name}</span>
                                  </div>
                                )}
                                {tourDate.notes && (
                                  <p className="text-sm text-muted-foreground pl-6">
                                    {tourDate.notes}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGenerateDaySheet(tourDate.id);
                                }}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="space-y-4">
                {/* Month Navigation */}
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={handlePreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-lg font-semibold">
                    {format(currentMonth, "MMMM yyyy", { locale: es })}
                  </h3>
                  <Button variant="outline" size="sm" onClick={handleNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-2">
                  {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day) => (
                    <div
                      key={day}
                      className="text-center text-sm font-medium text-muted-foreground py-2"
                    >
                      {day}
                    </div>
                  ))}
                  {calendarDays.map((day, index) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const tourDate = tourDatesMap.get(dateKey);
                    const isSelected = tourDate && selectedDateId === tourDate.id;

                    return (
                      <div
                        key={index}
                        className={cn(
                          "aspect-square p-2 border rounded-lg text-center cursor-pointer hover:bg-muted/50 transition-colors",
                          !isSameMonth(day, currentMonth) && "text-muted-foreground opacity-50",
                          tourDate && "bg-primary/10 border-primary",
                          isSelected && "ring-2 ring-primary"
                        )}
                        onClick={() => tourDate && handleDateClick(tourDate)}
                      >
                        <div className="text-sm font-medium">{format(day, 'd')}</div>
                        {tourDate && (
                          <div className="mt-1">
                            <Badge variant="secondary" className="text-xs px-1 py-0">
                              Tour
                            </Badge>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{sortedDates.length}</div>
                  <div className="text-xs text-muted-foreground">Fechas totales</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">
                    {new Set(sortedDates.map(d => d.location?.name).filter(Boolean)).size}
                  </div>
                  <div className="text-xs text-muted-foreground">Ubicaciones</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">
                    {sortedDates.length > 0
                      ? Math.ceil(
                          (new Date(sortedDates[sortedDates.length - 1].date).getTime() -
                            new Date(sortedDates[0].date).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Días de duración</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Selected Date Detail */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileText className="h-5 w-5" />
              Detalles de la Fecha
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Fecha</div>
                  <div className="font-semibold">
                    {format(new Date(selectedDate.date), "EEEE, d 'de' MMMM yyyy", {
                      locale: es,
                    })}
                  </div>
                </div>

                {selectedDate.location && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Ubicación</div>
                    <div className="font-semibold">{selectedDate.location.name}</div>
                    {selectedDate.location.address && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {selectedDate.location.address}
                      </div>
                    )}
                  </div>
                )}

                {selectedDate.notes && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Notas</div>
                    <div className="text-sm">{selectedDate.notes}</div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <Button
                    className="w-full justify-start"
                    variant="outline"
                    onClick={() => onGenerateDaySheet(selectedDate.id)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Generar Day Sheet
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <CloudSun className="h-4 w-4 mr-2" />
                    Ver Pronóstico
                  </Button>
                  <Button className="w-full justify-start" variant="outline">
                    <Users className="h-4 w-4 mr-2" />
                    Ver Asignaciones
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Selecciona una fecha para ver los detalles
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
