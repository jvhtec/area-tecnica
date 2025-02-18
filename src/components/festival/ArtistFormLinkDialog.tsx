
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  artistName,
}: ArtistFormLinkDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFormData = async () => {
      if (!open || !artistId) return;

      try {
        const { data, error } = await supabase
          .from('festival_artist_forms')
          .select('*')
          .eq('artist_id', artistId)
          .order('created_at', { ascending: false })
          .maybeSingle();

        if (error) throw error;
        setFormData(data);
      } catch (error) {
        console.error('Error fetching form data:', error);
        toast({
          title: "Error",
          description: "Failed to fetch form data",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchFormData();
  }, [open, artistId]);

  const copyLink = () => {
    if (!formData?.token) return;
    
    const link = `${window.location.origin}/festival/artist-form/${formData.token}`;
    navigator.clipboard.writeText(link);
    toast({
      title: "Copied",
      description: "Link copied to clipboard",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Form Link for {artistName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {formData?.token ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground break-all pr-4">
                  {`${window.location.origin}/festival/artist-form/${formData.token}`}
                </div>
                <Button variant="outline" size="sm" onClick={copyLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Badge>{formData.status}</Badge>
                {formData.expires_at && (
                  <Badge variant="secondary">
                    Expires {new Date(formData.expires_at).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">
              No form link generated yet. Use the "Generate Missing Links" button above to create one.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
