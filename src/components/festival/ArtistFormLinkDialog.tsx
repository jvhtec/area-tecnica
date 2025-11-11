
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Copy, RefreshCcw } from "lucide-react";
import { useState, useEffect } from "react";
import { addDays } from "date-fns";

interface ArtistFormLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string;
  artistName: string;
}

export const ArtistFormLinkDialog = ({
  open,
  onOpenChange,
  artistId,
  artistName
}: ArtistFormLinkDialogProps) => {
  const { toast } = useToast();
  const [formLink, setFormLink] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const generateNewLink = async () => {
    if (!artistId) {
      toast({
        title: "Error",
        description: "Se requiere el ID del artista para generar un enlace de formulario.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // First, mark any existing pending forms for THIS ARTIST as expired
      const { error: updateError } = await supabase
        .from('festival_artist_forms')
        .update({
          status: 'expired',
          expires_at: new Date().toISOString() // Expire immediately
        })
        .eq('artist_id', artistId) // Only affect THIS artist's forms
        .eq('status', 'pending');

      if (updateError) {
        console.error('Error expiring existing forms:', updateError);
        throw updateError;
      }

      // Create a new form entry that expires in 7 days
      const expiresAt = addDays(new Date(), 7);
      
      const { data, error } = await supabase
        .from('festival_artist_forms')
        .insert({
          artist_id: artistId,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })
        .select('token')
        .maybeSingle();

      if (error) {
        console.error('Error generating form link:', error);
        throw error;
      }

      if (!data?.token) {
        throw new Error('Failed to generate form token');
      }

      const formUrl = `${window.location.origin}/festival/artist-form/${data.token}`;
      setFormLink(formUrl);

      toast({
        title: "Enlace generado",
        description: "El nuevo enlace de formulario ha sido generado correctamente.",
      });
    } catch (error: any) {
      console.error('Error generating form link:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el enlace del formulario.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(formLink);
      toast({
        title: "Copiado",
        description: "Enlace copiado al portapapeles",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo copiar el enlace",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open && artistId) {
      // Check for existing unexpired form link for THIS SPECIFIC ARTIST
      const checkExistingLink = async () => {
        try {
          const { data, error } = await supabase
            .from('festival_artist_forms')
            .select('token')
            .eq('artist_id', artistId) // Only check THIS artist's forms
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error('Error checking existing link:', error);
            throw error;
          }

          if (data?.token) {
            const formUrl = `${window.location.origin}/festival/artist-form/${data.token}`;
            setFormLink(formUrl);
          } else {
            setFormLink("");
          }
        } catch (error) {
          console.error('Error checking existing link:', error);
          setFormLink("");
          toast({
            title: "Error",
            description: "No se pudo verificar el enlace de formulario existente.",
            variant: "destructive",
          });
        }
      };

      checkExistingLink();
    }
  }, [open, artistId, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enlace de Formulario para {artistName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {formLink ? (
            <>
              <div className="flex space-x-2">
                <Input
                  value={formLink}
                  readOnly
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                  title="Copiar enlace"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={generateNewLink}
                className="w-full"
                disabled={isLoading}
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Generar Nuevo Enlace
              </Button>
            </>
          ) : (
            <Button
              onClick={generateNewLink}
              className="w-full"
              disabled={isLoading}
            >
              Generar Enlace
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
