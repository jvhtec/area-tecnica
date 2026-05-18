import { useParams } from "react-router-dom";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";
import { AlertTriangle, Calendar, Loader2, LockKeyhole, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TourOpsMobileItinerary } from "@/features/tour-ops/TourOpsMobileItinerary";
import { useTourOpsShare } from "@/features/tour-ops/useTourOps";
import { generateTourOpsPdf } from "@/features/tour-ops/tourOpsPdf";
import { MADRID_TIMEZONE } from "@/utils/timezoneUtils";

export default function TourShare() {
  const { token } = useParams();
  const { data: model, isLoading, error } = useTourOpsShare(token);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando gira...</p>
        </div>
      </main>
    );
  }

  if (error || !model) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <LockKeyhole className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
            <h1 className="text-xl font-semibold mb-2">Enlace no disponible</h1>
            <p className="text-sm text-muted-foreground">
              Este enlace de gira no existe, ha caducado o fue revocado.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-muted/30">
      <section className="bg-background border-b">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Share2 className="h-4 w-4" />
                Itinerario externo
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold">{model.tour.name}</h1>
              {model.tour.description && (
                <p className="mt-1 text-muted-foreground">{model.tour.description}</p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Calendar className="h-3 w-3" />
                  {model.stats.totalDates} fechas
                </Badge>
                {model.share?.expiresAt && (
                  <Badge variant="secondary">
                    Caduca {formatInTimeZone(model.share.expiresAt, MADRID_TIMEZONE, "d MMM yyyy", { locale: es })}
                  </Badge>
                )}
              </div>
            </div>
            <Button onClick={() => generateTourOpsPdf(model, "guest")}>
              Descargar PDF
            </Button>
          </div>
        </div>
      </section>

      {!model.allowedSections.overview && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="rounded-lg border bg-amber-50 p-3 text-sm text-amber-900 flex gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            Algunas secciones están ocultas por la configuración del enlace.
          </div>
        </div>
      )}

      <section className="mx-auto max-w-5xl px-4 py-5">
        <TourOpsMobileItinerary model={model} projection="guest" shareToken={token} />
      </section>
    </main>
  );
}
