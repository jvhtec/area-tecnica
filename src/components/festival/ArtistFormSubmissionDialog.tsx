
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";

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
  const { toast } = useToast();

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

  const handleDownload = async () => {
    if (!submission) return;

    try {
      // Create PDF
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.text("Artist Form Submission", 20, 20);
      
      // Add submission date
      doc.setFontSize(12);
      doc.text(`Submitted on: ${format(new Date(submission.submitted_at), 'PPpp')}`, 20, 35);
      
      // Add form data
      doc.setFontSize(14);
      doc.text("Form Data:", 20, 50);
      
      // Convert form data to formatted text
      const formDataText = Object.entries(submission.form_data)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join('\n');
      
      // Add form data with word wrap
      const splitText = doc.splitTextToSize(formDataText, 170);
      doc.setFontSize(12);
      doc.text(splitText, 20, 65);
      
      // Add notes if they exist
      if (submission.notes) {
        const yPos = 65 + (splitText.length * 7);
        doc.setFontSize(14);
        doc.text("Notes:", 20, yPos);
        doc.setFontSize(12);
        const splitNotes = doc.splitTextToSize(submission.notes, 170);
        doc.text(splitNotes, 20, yPos + 10);
      }

      // Save the PDF
      doc.save("form_submission.pdf");

      toast({
        title: "Success",
        description: "Form submission downloaded successfully",
      });
    } catch (error) {
      console.error('Error downloading submission:', error);
      toast({
        title: "Error",
        description: "Could not download the form submission",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Form Submission Details</DialogTitle>
          {submission && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="ml-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          )}
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
                <pre className="bg-muted p-4 rounded-lg overflow-auto whitespace-pre-wrap">
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
