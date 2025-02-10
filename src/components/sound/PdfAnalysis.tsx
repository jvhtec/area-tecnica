import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnalysisResult {
  microphones: Array<{ model: string; quantity: number }>;
  stands: Array<{ type: string; quantity: number }>;
}

export const PdfAnalysis = () => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalysisResult | null>(null);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsAnalyzing(true);
      console.log('Starting PDF analysis process');

      // Upload file to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const filePath = `analysis/${crypto.randomUUID()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job_documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('job_documents')
        .getPublicUrl(filePath);

      console.log('File uploaded, public URL:', publicUrl);

      // Call our edge function to analyze the PDF
      const { data: analysisData, error: analysisError } = await supabase.functions
        .invoke('analyze-pdf', {
          body: { fileUrl: publicUrl }
        });

      if (analysisError) {
        console.error('Analysis error:', analysisError);
        throw analysisError;
      }

      console.log('Analysis completed:', analysisData);
      setResults(analysisData);

      toast({
        title: "Analysis Complete",
        description: "The PDF has been successfully analyzed.",
      });

    } catch (error: any) {
      console.error('Error in handleFileUpload:', error);
      toast({
        title: "Analysis Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Analysis
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <input
                type="file"
                onChange={handleFileUpload}
                accept=".pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isAnalyzing}
              />
              <Button
                variant="outline"
                className="gap-2"
                disabled={isAnalyzing}
              >
                {isAnalyzing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Upload PDF for Analysis
              </Button>
            </div>
          </div>

          {results && (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Microphones</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.microphones.map((mic, index) => (
                      <TableRow key={index}>
                        <TableCell>{mic.model}</TableCell>
                        <TableCell>{mic.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-2">Stands</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.stands.map((stand, index) => (
                      <TableRow key={index}>
                        <TableCell>{stand.type}</TableCell>
                        <TableCell>{stand.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};