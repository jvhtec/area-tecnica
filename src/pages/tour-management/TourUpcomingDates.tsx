/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, MapPin } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TourDateFlexButton } from "@/components/tours/TourDateFlexButton";

type Props = { isTechnicianView: boolean; upcomingDates: any[] };

export const TourUpcomingDates = ({ isTechnicianView, upcomingDates }: Props) => (
  <>
      {/* Upcoming Dates Section */}
      {upcomingDates.length > 0 && (
        <div>
          <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4 px-1">Próximas Fechas de Gira</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
            {upcomingDates.map((date: any) => (
              <Card key={date.id}>
                <CardHeader className="pb-3 px-3 md:px-6 pt-3 md:pt-6">
                  <div className="flex items-center justify-between">
                    <Calendar className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground flex-shrink-0" />
                    <Badge variant="outline" className="text-xs">
                      {format(new Date(date.date), "d MMM", { locale: es })}
                    </Badge>
                  </div>
                  <CardTitle className="text-sm md:text-base mt-2">
                    {format(new Date(date.date), "EEEE, d 'de' MMMM 'de' yyyy", { locale: es })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
                  {date.location?.name && (
                    <div className="flex items-start gap-2 text-xs md:text-sm text-muted-foreground mb-2">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span className="break-words">{date.location.name}</span>
                    </div>
                  )}
                  {!isTechnicianView && <TourDateFlexButton tourDateId={date.id} />}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
  </>
);
