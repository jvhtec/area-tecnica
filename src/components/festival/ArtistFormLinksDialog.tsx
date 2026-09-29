import { useState } from "react";
import { isAfter } from "date-fns";
import { Copy, Printer } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { trackError } from "@/lib/errorTracking";
import { formatFestivalDayKey, formatFestivalInstant } from "@/features/festival-management/dateFormatting";
import { downloadBlobInBrowser } from "@/features/festival-management/commands";
import { buildStageBlankTemplatePdf } from "@/features/festival-forms/blankTemplatePdf";
import { useArtistFormLinks } from "@/features/festival-forms/hooks/useArtistFormLinks";
import {
  buildAllLinksText,
  buildArtistFormUrl,
  buildStageLinksText,
  formatStageLabel,
  sortStages,
} from "@/features/festival-forms/links";

const ALL_DATES_VALUE = "__all_dates__";

const formatDateLabel = (value?: string | null) =>
  value ? formatFestivalDayKey(value, "dd/MM/yyyy", "Sin fecha") : "Sin fecha";

interface ArtistFormLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  jobId: string;
}

export const ArtistFormLinksDialog = ({ open, onOpenChange, selectedDate, jobId }: ArtistFormLinksDialogProps) => {
  const { toast } = useToast();
  const { links, isLoading } = useArtistFormLinks(jobId, open);
  const [isGeneratingBlankPdf, setIsGeneratingBlankPdf] = useState(false);
  // `null` follows the date the page has selected; picking one here overrides it until closed.
  const [pickedFilter, setPickedFilter] = useState<{ forDate: string; value: string } | null>(null);
  const dateFilter =
    pickedFilter && pickedFilter.forDate === selectedDate ? pickedFilter.value : selectedDate || ALL_DATES_VALUE;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) setPickedFilter(null);
    onOpenChange(nextOpen);
  };

  const isAllDates = dateFilter === ALL_DATES_VALUE;
  const filteredLinks = links.filter((artist) => isAllDates || artist.date === dateFilter);
  const scopeLabel = isAllDates ? "Todas las fechas" : formatDateLabel(dateFilter);
  const availableDates = [...new Set(links.map((artist) => artist.date).filter((date): date is string => !!date))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );
  const stages = sortStages(filteredLinks.map((artist) => artist.stage));
  const linksTextOptions = { scopeLabel, showDate: isAllDates, formatDate: formatDateLabel };

  const copyText = (text: string, description: string) => {
    void navigator.clipboard.writeText(text);
    toast({ title: "Copiado", description });
  };

  const downloadBlankTemplatePdf = async (stageNumber?: number) => {
    if (isAllDates) {
      toast({
        title: "Selecciona una fecha",
        description: "La plantilla en blanco requiere una fecha específica.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBlankPdf(true);
    try {
      const { blob, fileName } = await buildStageBlankTemplatePdf({
        jobId,
        date: dateFilter,
        stage: stageNumber ?? filteredLinks[0]?.stage ?? 1,
      });
      downloadBlobInBrowser(blob, fileName);
    } catch (error) {
      void trackError(error, { system: "festivals", operation: "download-stage-blank-template", jobId });
      toast({ title: "Error", description: "No se pudo generar la plantilla PDF.", variant: "destructive" });
    } finally {
      setIsGeneratingBlankPdf(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <Loading hideLabel size="lg" className="h-40" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[calc(80vh_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enlaces de Formularios de Artistas - {scopeLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-md border border-muted px-3 py-2 text-sm text-muted-foreground">
            Los enlaces públicos se crean al enviar cada formulario y expiran en 7 días. Puedes filtrar por fecha o ver
            todas las fechas del trabajo.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Fecha:</span>
            <Select
              value={dateFilter}
              onValueChange={(value) => setPickedFilter({ forDate: selectedDate, value })}
            >
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Selecciona fecha" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DATES_VALUE}>Todas las fechas</SelectItem>
                {availableDates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {formatDateLabel(date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => downloadBlankTemplatePdf()}
                disabled={isGeneratingBlankPdf || isAllDates}
              >
                <Printer className="h-4 w-4 mr-2" />
                {isGeneratingBlankPdf ? "Generando Plantilla..." : "Plantilla PDF en Blanco"}
              </Button>
              <Button
                onClick={() =>
                  copyText(buildAllLinksText(filteredLinks, linksTextOptions), "Todos los enlaces copiados al portapapeles")
                }
                disabled={filteredLinks.length === 0}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar Todos los Enlaces
              </Button>
            </div>
          </div>

          {stages.map((stage) => (
            <div key={stage ?? "sin-escenario"} className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">{formatStageLabel(stage)}</h3>
                <div className="flex items-center gap-2">
                  {/* A blank template is stage-scoped, so it has no meaning without a stage. */}
                  {stage !== null && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadBlankTemplatePdf(stage)}
                      disabled={isGeneratingBlankPdf}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Plantilla de Escenario
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyText(
                        buildStageLinksText(filteredLinks, stage, linksTextOptions),
                        `Enlaces de ${formatStageLabel(stage)} copiados al portapapeles`,
                      )
                    }
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Enlaces del Escenario
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg divide-y">
                {filteredLinks
                  .filter((artist) => artist.stage === stage)
                  .map((artist) => (
                    <div key={artist.artistId} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{artist.name}</span>
                        {isAllDates && artist.date && <Badge variant="outline">{formatDateLabel(artist.date)}</Badge>}
                      </div>
                      <div className="flex items-center gap-2">
                        {artist.token ? (
                          <>
                            {artist.status === "expired" && <Badge variant="destructive">Expirado</Badge>}
                            {artist.expires_at && isAfter(new Date(artist.expires_at), new Date()) && (
                              <Badge variant="secondary">
                                Expira {formatFestivalInstant(artist.expires_at, "dd/MM/yyyy")}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                copyText(
                                  buildArtistFormUrl(artist.token!, artist.form_language),
                                  "Enlace copiado al portapapeles",
                                )
                              }
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline">Sin enlace generado</Badge>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
          {filteredLinks.length === 0 && (
            <div className="text-sm text-muted-foreground">No hay artistas para la fecha seleccionada.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
