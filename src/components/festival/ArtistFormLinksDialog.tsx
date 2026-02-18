
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Copy, RefreshCcw, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { addDays, format, isAfter } from "date-fns";
import { exportArtistPDF, ArtistPdfData } from "@/utils/artistPdfExport";
import { fetchJobLogo } from "@/utils/pdf/logoUtils";
import { fetchFestivalGearOptionsForTemplate } from "@/utils/festivalGearOptions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildReadableFilename } from "@/utils/fileName";

interface ArtistLinkData {
  artistId: string;
  name: string;
  stage: number;
  date?: string | null;
  form_language?: "es" | "en";
  token?: string;
  expires_at?: string;
  status?: string;
}

interface ArtistFormLinksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: string;
  jobId: string;
}

export const ArtistFormLinksDialog = ({
  open,
  onOpenChange,
  selectedDate,
  jobId
}: ArtistFormLinksDialogProps) => {
  const ALL_DATES_VALUE = "__all_dates__";
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [artistLinks, setArtistLinks] = useState<ArtistLinkData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingBlankPdf, setIsGeneratingBlankPdf] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>(selectedDate || ALL_DATES_VALUE);

  const fetchArtistLinks = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: artistsData, error: artistsError } = await supabase
        .from('festival_artists')
        .select('id, name, stage, date, form_language')
        .eq('job_id', jobId)
        .not('date', 'is', null)
        .order('date')
        .order('stage')
        .order('show_start');

      if (artistsError) throw artistsError;

      if (!artistsData || artistsData.length === 0) {
        setArtistLinks([]);
        return;
      }

      const artistIds = artistsData.map((artist) => artist.id);

      const { data: formsData, error: formsError } = await supabase
        .from('festival_artist_forms')
        .select('artist_id, token, expires_at, status, updated_at, created_at')
        .in('artist_id', artistIds)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false });

      if (formsError) throw formsError;

      const now = new Date();
      const formByArtistId = new Map<
        string,
        { token?: string; expires_at?: string; status?: string; updated_at?: string | null; created_at?: string | null }
      >();

      (formsData || []).forEach((form) => {
        if (!form.artist_id) return;

        const current = formByArtistId.get(form.artist_id);
        const isFormActive = form.status === 'pending' && !!form.expires_at && isAfter(new Date(form.expires_at), now);

        if (!current) {
          formByArtistId.set(form.artist_id, form);
          return;
        }

        const isCurrentActive =
          current.status === 'pending' &&
          !!current.expires_at &&
          isAfter(new Date(current.expires_at), now);

        if (isFormActive && !isCurrentActive) {
          formByArtistId.set(form.artist_id, form);
        }
      });

      const formattedData: ArtistLinkData[] = artistsData.map((artist) => {
        const form = formByArtistId.get(artist.id);
        return {
          artistId: artist.id,
          name: artist.name,
          stage: artist.stage,
          date: artist.date,
          form_language: artist.form_language === "en" ? "en" : "es",
          token: form?.token ?? undefined,
          expires_at: form?.expires_at ?? undefined,
          status: form?.status ?? undefined,
        };
      });

      setArtistLinks(formattedData);
    } catch (error) {
      console.error('Error fetching artist links:', error);
      toast({
        title: "Error",
        description: "No se pudieron obtener los enlaces de artistas",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [jobId, selectedDate, toast]);

  useEffect(() => {
    if (open) {
      fetchArtistLinks();
    }
  }, [fetchArtistLinks, open]);

  useEffect(() => {
    if (!open) return;
    setDateFilter(selectedDate || ALL_DATES_VALUE);
  }, [open, selectedDate]);

  const filteredArtistLinks = artistLinks.filter((artist) =>
    dateFilter === ALL_DATES_VALUE ? true : artist.date === dateFilter,
  );

  const formatDateLabel = (value?: string | null) => {
    if (!value) return "Sin fecha";
    return format(new Date(value), "dd/MM/yyyy");
  };

  const availableDates = [...new Set(artistLinks.map((artist) => artist.date).filter(Boolean) as string[])].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  const generateLinks = async () => {
    setIsGenerating(true);
    try {
      for (const artist of filteredArtistLinks) {
        if (!artist.token || 
            (artist.expires_at && !isAfter(new Date(artist.expires_at), new Date()))) {
          await supabase
            .from('festival_artist_forms')
            .update({
              status: 'expired',
              expires_at: new Date().toISOString()
            })
            .eq('artist_id', artist.artistId)
            .eq('status', 'pending');

          const expiresAt = addDays(new Date(), 7);
          await supabase
            .from('festival_artist_forms')
            .insert({
              artist_id: artist.artistId,
              expires_at: expiresAt.toISOString(),
              status: 'pending'
            });
        }
      }

      await fetchArtistLinks();
      toast({
        title: "Éxito",
        description:
          dateFilter === ALL_DATES_VALUE
            ? "Enlaces faltantes generados correctamente para todas las fechas"
            : "Enlaces faltantes generados correctamente para la fecha seleccionada",
      });
    } catch (error) {
      console.error('Error generating links:', error);
      toast({
        title: "Error",
        description: "No se pudieron generar los enlaces",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyAllLinks = () => {
    const buildLink = (artist: ArtistLinkData) =>
      artist.token
        ? `${window.location.origin}/festival/artist-form/${artist.token}?lang=${artist.form_language === "en" ? "en" : "es"}`
        : "Enlace aún no generado";

    const groupedByStage = filteredArtistLinks.reduce((acc, artist) => {
      const stage = `Stage ${artist.stage}`;
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(artist);
      return acc;
    }, {} as Record<string, ArtistLinkData[]>);

    const scopeLabel =
      dateFilter === ALL_DATES_VALUE
        ? "Todas las fechas"
        : formatDateLabel(dateFilter);
    let text = `Enlaces de Formularios de Artistas - ${scopeLabel}\n\n`;

    Object.entries(groupedByStage).forEach(([stage, artists]) => {
      text += `${stage}:\n`;
      artists.forEach(artist => {
        const link = buildLink(artist);
        text += `${artist.name}${dateFilter === ALL_DATES_VALUE ? ` (${formatDateLabel(artist.date)})` : ""} - ${link}\n`;
      });
      text += '\n';
    });

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Todos los enlaces copiados al portapapeles",
    });
  };

  const copyStageLinks = (stage: number) => {
    const buildLink = (artist: ArtistLinkData) =>
      artist.token
        ? `${window.location.origin}/festival/artist-form/${artist.token}?lang=${artist.form_language === "en" ? "en" : "es"}`
        : "Enlace aún no generado";

    const stageArtists = filteredArtistLinks.filter(a => a.stage === stage);
    const scopeLabel =
      dateFilter === ALL_DATES_VALUE
        ? "Todas las fechas"
        : formatDateLabel(dateFilter);
    let text = `Stage ${stage} - ${scopeLabel}\n\n`;

    stageArtists.forEach(artist => {
      const link = buildLink(artist);
      text += `${artist.name}${dateFilter === ALL_DATES_VALUE ? ` (${formatDateLabel(artist.date)})` : ""} - ${link}\n`;
    });

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: `Enlaces del Stage ${stage} copiados al portapapeles`,
    });
  };

  const downloadBlankTemplatePdf = async (stageNumber?: number) => {
    if (dateFilter === ALL_DATES_VALUE) {
      toast({
        title: "Selecciona una fecha",
        description: "La plantilla en blanco requiere una fecha específica.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingBlankPdf(true);
    try {
      let logoUrl: string | undefined;
      let festivalOptions: ArtistPdfData["festivalOptions"];
      const templateStage = stageNumber ?? filteredArtistLinks[0]?.stage ?? 1;
      if (jobId) {
        logoUrl = await fetchJobLogo(jobId);
        festivalOptions = await fetchFestivalGearOptionsForTemplate(jobId, templateStage);
      }

      const blankPdfData: ArtistPdfData = {
        name: "Plantilla Artista",
        stage: templateStage,
        date: dateFilter,
        schedule: {
          show: {
            start: "",
            end: "",
          },
        },
        technical: {
          fohTech: false,
          monTech: false,
          fohConsole: { model: "", providedBy: "festival" },
          monConsole: { model: "", providedBy: "festival" },
          wireless: { systems: [], providedBy: "festival" },
          iem: { systems: [], providedBy: "festival" },
          monitors: { enabled: false, quantity: 0 },
        },
        infrastructure: {
          providedBy: "festival",
          cat6: { enabled: false, quantity: 0 },
          hma: { enabled: false, quantity: 0 },
          coax: { enabled: false, quantity: 0 },
          opticalconDuo: { enabled: false, quantity: 0 },
          analog: 0,
          other: "",
        },
        extras: {
          sideFill: false,
          drumFill: false,
          djBooth: false,
          wired: "",
        },
        notes: "",
        wiredMics: [],
        logoUrl,
        festivalOptions,
      };

      const blob = await exportArtistPDF(blankPdfData, { templateMode: true });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildReadableFilename(["Plantilla en blanco artista", dateFilter]);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating blank template PDF:", error);
      toast({
        title: "Error",
        description: "No se pudo generar la plantilla PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingBlankPdf(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const stages = [...new Set(filteredArtistLinks.map(a => a.stage))].sort();
  const titleDate = dateFilter === ALL_DATES_VALUE ? "Todas las fechas" : formatDateLabel(dateFilter);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enlaces de Formularios de Artistas - {titleDate}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-md border border-muted px-3 py-2 text-sm text-muted-foreground">
            Los enlaces públicos expiran en 7 días. Puedes filtrar por fecha o ver todas las fechas del festival.
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Fecha:</span>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-[240px]">
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
          <div className="flex justify-between items-center">
            <Button onClick={generateLinks} disabled={isGenerating || filteredArtistLinks.length === 0}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              {dateFilter === ALL_DATES_VALUE ? "Generar Enlaces Faltantes (Todas)" : "Generar Enlaces Faltantes"}
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={downloadBlankTemplatePdf}
                disabled={isGeneratingBlankPdf || dateFilter === ALL_DATES_VALUE}
              >
                <Printer className="h-4 w-4 mr-2" />
                {isGeneratingBlankPdf ? "Generando Plantilla..." : "Plantilla PDF en Blanco"}
              </Button>
              <Button onClick={copyAllLinks} disabled={filteredArtistLinks.length === 0}>
                <Copy className="h-4 w-4 mr-2" />
                Copiar Todos los Enlaces
              </Button>
            </div>
          </div>

          {stages.map(stage => (
            <div key={stage} className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Stage {stage}</h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadBlankTemplatePdf(stage)}
                    disabled={isGeneratingBlankPdf}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Plantilla Stage
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => copyStageLinks(stage)}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Enlaces del Stage
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg divide-y">
                {filteredArtistLinks
                  .filter(artist => artist.stage === stage)
                  .map(artist => (
                    <div key={artist.artistId} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{artist.name}</span>
                        {dateFilter === ALL_DATES_VALUE && artist.date && (
                          <Badge variant="outline">{formatDateLabel(artist.date)}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {artist.token ? (
                          <>
                            {artist.status === 'expired' && (
                              <Badge variant="destructive">Expirado</Badge>
                            )}
                            {artist.expires_at && isAfter(new Date(artist.expires_at), new Date()) && (
                              <Badge variant="secondary">
                                Expira {format(new Date(artist.expires_at), 'dd/MM/yyyy')}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = `${window.location.origin}/festival/artist-form/${artist.token}?lang=${artist.form_language === "en" ? "en" : "es"}`;
                                navigator.clipboard.writeText(link);
                                toast({
                                  title: "Copiado",
                                  description: "Enlace copiado al portapapeles",
                                });
                              }}
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
          {filteredArtistLinks.length === 0 && (
            <div className="text-sm text-muted-foreground">No hay artistas para la fecha seleccionada.</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
