
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Loader2, Copy, RefreshCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { addDays, format, isAfter } from "date-fns";

interface ArtistLinkData {
  artistId: string;
  name: string;
  stage: number;
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

  const fetchArtistLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('festival_artists')
        .select(`
          id,
          name,
          stage,
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
  };

  useEffect(() => {
    if (open) {
      fetchArtistLinks();
    }
  }, [open, jobId, selectedDate]);

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
        const link = artist.token
          ? `${window.location.origin}/festival/artist-form/${artist.token}`
          : 'Enlace aún no generado';
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
    const stageArtists = artistLinks.filter(a => a.stage === stage);
    let text = `Stage ${stage} - ${format(new Date(selectedDate), 'dd/MM/yyyy')}\n\n`;

    stageArtists.forEach(artist => {
      const link = artist.token
        ? `${window.location.origin}/festival/artist-form/${artist.token}`
        : 'Enlace aún no generado';
      text += `${artist.name} - ${link}\n`;
    });

    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: `Enlaces del Stage ${stage} copiados al portapapeles`,
    });
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
          <div className="flex justify-between items-center">
            <Button onClick={generateLinks} disabled={isGenerating}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generar Enlaces Faltantes
            </Button>
            <Button onClick={copyAllLinks}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar Todos los Enlaces
            </Button>
          </div>

          {stages.map(stage => (
            <div key={stage} className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Stage {stage}</h3>
                <Button variant="outline" size="sm" onClick={() => copyStageLinks(stage)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar Enlaces del Stage
                </Button>
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
                                const link = `${window.location.origin}/festival/artist-form/${artist.token}`;
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
