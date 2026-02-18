
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

interface ArtistLinkData {
  artistId: string;
  name: string;
  stage: number;
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
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [artistLinks, setArtistLinks] = useState<ArtistLinkData[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingBlankPdf, setIsGeneratingBlankPdf] = useState(false);

  const fetchArtistLinks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('festival_artists')
        .select(`
          id,
          name,
          stage,
          form_language,
          festival_artist_forms (
            token,
            expires_at,
            status
          )
        `)
        .eq('job_id', jobId)
        .eq('date', selectedDate)
        .order('stage')
        .order('show_start');

      if (error) throw error;

      const formattedData: ArtistLinkData[] = data.map(artist => ({
        artistId: artist.id,
        name: artist.name,
        stage: artist.stage,
        form_language: artist.form_language === "en" ? "en" : "es",
        token: artist.festival_artist_forms?.[0]?.token,
        expires_at: artist.festival_artist_forms?.[0]?.expires_at,
        status: artist.festival_artist_forms?.[0]?.status,
      }));

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

  const generateLinks = async () => {
    setIsGenerating(true);
    try {
      for (const artist of artistLinks) {
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
        description: "Enlaces faltantes generados correctamente",
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

    const groupedByStage = artistLinks.reduce((acc, artist) => {
      const stage = `Stage ${artist.stage}`;
      if (!acc[stage]) acc[stage] = [];
      acc[stage].push(artist);
      return acc;
    }, {} as Record<string, ArtistLinkData[]>);

    let text = `Enlaces de Formularios de Artistas - ${format(new Date(selectedDate), 'dd/MM/yyyy')}\n\n`;

    Object.entries(groupedByStage).forEach(([stage, artists]) => {
      text += `${stage}:\n`;
      artists.forEach(artist => {
        const link = buildLink(artist);
        text += `${artist.name} - ${link}\n`;
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

    const stageArtists = artistLinks.filter(a => a.stage === stage);
    let text = `Stage ${stage} - ${format(new Date(selectedDate), 'dd/MM/yyyy')}\n\n`;

    stageArtists.forEach(artist => {
      const link = buildLink(artist);
      text += `${artist.name} - ${link}\n`;
    });

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: `Enlaces del Stage ${stage} copiados al portapapeles`,
    });
  };

  const downloadBlankTemplatePdf = async (stageNumber?: number) => {
    setIsGeneratingBlankPdf(true);
    try {
      let logoUrl: string | undefined;
      let festivalOptions: ArtistPdfData["festivalOptions"];
      const templateStage = stageNumber ?? artistLinks[0]?.stage ?? 1;
      if (jobId) {
        logoUrl = await fetchJobLogo(jobId);
        festivalOptions = await fetchFestivalGearOptionsForTemplate(jobId, templateStage);
      }

      const blankPdfData: ArtistPdfData = {
        name: "Plantilla Artista",
        stage: templateStage,
        date: selectedDate,
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
      a.download = `Plantilla_Blanca_Artista_${selectedDate}.pdf`;
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

  const stages = [...new Set(artistLinks.map(a => a.stage))].sort();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enlaces de Formularios de Artistas - {format(new Date(selectedDate), 'dd/MM/yyyy')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="rounded-md border border-muted px-3 py-2 text-sm text-muted-foreground">
            Los enlaces públicos expiran en 7 días. Si necesitas rotarlos antes, usa "Generar Enlaces Faltantes" o regenera el enlace del artista.
          </div>
          <div className="flex justify-between items-center">
            <Button onClick={generateLinks} disabled={isGenerating}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generar Enlaces Faltantes
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={downloadBlankTemplatePdf} disabled={isGeneratingBlankPdf}>
                <Printer className="h-4 w-4 mr-2" />
                {isGeneratingBlankPdf ? "Generando Plantilla..." : "Plantilla PDF en Blanco"}
              </Button>
              <Button onClick={copyAllLinks}>
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
                {artistLinks
                  .filter(artist => artist.stage === stage)
                  .map(artist => (
                    <div key={artist.artistId} className="p-3 flex items-center justify-between">
                      <span className="font-medium">{artist.name}</span>
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
        </div>
      </DialogContent>
    </Dialog>
  );
};
