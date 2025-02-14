
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
    setIsLoading(true);
    try {
      // First, mark any existing pending forms as expired
      const { error: updateError } = await supabase
        .from('festival_artist_forms')
        .update({
          status: 'expired',
          expires_at: new Date().toISOString() // Expire immediately
        })
        .eq('artist_id', artistId)
        .eq('status', 'pending');

      if (updateError) throw updateError;

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

      if (error) throw error;
      if (!data) throw new Error('Failed to generate form link');

      const formUrl = `${window.location.origin}/festival/artist-form/${data.token}`;
      setFormLink(formUrl);
      
      toast({
        title: "Link generated",
        description: "New form link has been generated successfully.",
      });
    } catch (error: any) {
      console.error('Error generating form link:', error);
      toast({
        title: "Error",
        description: "Failed to generate form link.",
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
        title: "Copied",
        description: "Link copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy link",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    if (open) {
      // Check for existing unexpired form link
      const checkExistingLink = async () => {
        try {
          const { data, error } = await supabase
            .from('festival_artist_forms')
            .select('token')
            .eq('artist_id', artistId)
            .eq('status', 'pending')
            .gt('expires_at', new Date().toISOString())
            .limit(1)
            .maybeSingle();

          if (error) throw error;

          if (data?.token) {
            const formUrl = `${window.location.origin}/festival/artist-form/${data.token}`;
            setFormLink(formUrl);
          } else {
            setFormLink("");
          }
        } catch (error) {
          console.error('Error checking existing link:', error);
          setFormLink("");
        }
      };

      checkExistingLink();
    }
  }, [open, artistId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Form Link for {artistName}</DialogTitle>
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
                  title="Copy link"
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
                Generate New Link
              </Button>
            </>
          ) : (
            <Button
              onClick={generateNewLink}
              className="w-full"
              disabled={isLoading}
            >
              Generate Link
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
