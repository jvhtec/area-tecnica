
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ArtistFormSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artistId: string;
}

interface FormSubmission {
  id: string;
  submitted_at: string;
  form_data: any;
  status: string;
  notes?: string;
}

export const ArtistFormSubmissionDialog = ({
  open,
  onOpenChange,
  artistId,
}: ArtistFormSubmissionDialogProps) => {
  const [submission, setSubmission] = useState<FormSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchSubmission = async () => {
      if (!open || !artistId) return;

      setIsLoading(true);
      try {
        // First get the form ID
        const { data: formData } = await supabase
          .from('festival_artist_forms')
          .select('id')
          .eq('artist_id', artistId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (formData?.id) {
          const { data: submissionData } = await supabase
            .from('festival_artist_form_submissions')
            .select('*')
            .eq('form_id', formData.id)
            .order('submitted_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          setSubmission(submissionData);
        }
      } catch (error) {
        console.error('Error fetching submission:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmission();
  }, [open, artistId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Form Submission Details</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : !submission ? (
          <div className="text-center p-4 text-muted-foreground">
            No submission found for this artist.
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              <div className="text-sm text-muted-foreground">
                Submitted on: {format(new Date(submission.submitted_at), 'PPpp')}
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Submitted Data</h3>
                <pre className="bg-muted p-4 rounded-lg overflow-auto">
                  {JSON.stringify(submission.form_data, null, 2)}
                </pre>
              </div>

              {submission.notes && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Notes</h3>
                  <p className="text-muted-foreground">{submission.notes}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
