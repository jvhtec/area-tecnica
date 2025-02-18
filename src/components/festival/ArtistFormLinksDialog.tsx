
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
  shortened_url?: string;
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

  const shortenUrl = async (url: string) => {
    try {
      const response = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      if (!response.ok) throw new Error('Failed to shorten URL');
      return await response.text();
    } catch (error) {
      console.error('Error shortening URL:', error);
      return null;
    }
  };

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
            shortened_url,
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
        shortened_url: artist.festival_artist_forms?.[0]?.shortened_url,
        expires_at: artist.festival_artist_forms?.[0]?.expires_at,
        status: artist.festival_artist_forms?.[0]?.status,
      }));

      setArtistLinks(formattedData);
    } catch (error) {
      console.error('Error fetching artist links:', error);
      toast({
        title: "Error",
        description: "Failed to fetch artist links",
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
          // First, mark any existing pending forms for this artist as expired
          await supabase
            .from('festival_artist_forms')
            .update({
              status: 'expired',
              expires_at: new Date().toISOString()
            })
            .eq('artist_id', artist.artistId)
            .eq('status', 'pending');

          // Create a new form entry that expires in 7 days
          const expiresAt = addDays(new Date(), 7);
          const { data: newForm } = await supabase
            .from('festival_artist_forms')
            .insert({
              artist_id: artist.artistId,
              expires_at: expiresAt.toISOString(),
              status: 'pending'
            })
            .select('token')
            .single();

          if (newForm?.token) {
            const fullUrl = `${window.location.origin}/festival/artist-form/${newForm.token}`;
            const shortUrl = await shortenUrl(fullUrl);
            
            if (shortUrl) {
              await supabase
                .from('festival_artist_forms')
                .update({ shortened_url: shortUrl })
                .eq('token', newForm.token);
            }
          }
        }
      }

      await fetchArtistLinks();
      toast({
        title: "Success",
        description: "Generated missing links successfully",
      });
    } catch (error) {
      console.error('Error generating links:', error);
      toast({
        title: "Error",
        description: "Failed to generate links",
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

    let text = `Artist Form Links - ${format(new Date(selectedDate), 'dd/MM/yyyy')}\n\n`;

    Object.entries(groupedByStage).forEach(([stage, artists]) => {
      text += `${stage}:\n`;
      artists.forEach(artist => {
        const link = artist.shortened_url || 
          (artist.token ? `${window.location.origin}/festival/artist-form/${artist.token}` : 'No link generated yet');
        text += `${artist.name} - ${link}\n`;
      });
      text += '\n';
    });

    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "All links copied to clipboard",
    });
  };

  const copyStageLinks = (stage: number) => {
    const stageArtists = artistLinks.filter(a => a.stage === stage);
    let text = `Stage ${stage} - ${format(new Date(selectedDate), 'dd/MM/yyyy')}\n\n`;
    
    stageArtists.forEach(artist => {
      const link = artist.shortened_url || 
        (artist.token ? `${window.location.origin}/festival/artist-form/${artist.token}` : 'No link generated yet');
      text += `${artist.name} - ${link}\n`;
    });

    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: `Stage ${stage} links copied to clipboard`,
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
          <DialogTitle>Artist Form Links - {format(new Date(selectedDate), 'dd/MM/yyyy')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Button onClick={generateLinks} disabled={isGenerating}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate Missing Links
            </Button>
            <Button onClick={copyAllLinks}>
              <Copy className="h-4 w-4 mr-2" />
              Copy All Links
            </Button>
          </div>

          {stages.map(stage => (
            <div key={stage} className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Stage {stage}</h3>
                <Button variant="outline" size="sm" onClick={() => copyStageLinks(stage)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Stage Links
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
                              <Badge variant="destructive">Expired</Badge>
                            )}
                            {artist.expires_at && isAfter(new Date(artist.expires_at), new Date()) && (
                              <Badge variant="secondary">
                                Expires {format(new Date(artist.expires_at), 'dd/MM/yyyy')}
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const link = artist.shortened_url || 
                                  `${window.location.origin}/festival/artist-form/${artist.token}`;
                                navigator.clipboard.writeText(link);
                                toast({
                                  title: "Copied",
                                  description: "Link copied to clipboard",
                                });
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Badge variant="outline">No link generated</Badge>
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

