import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Copy, Save, Wrench, Printer, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/enhanced-supabase-client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { ConnectionIndicator } from "@/components/ui/connection-indicator";
import { FestivalGearSetupForm } from "@/components/festival/FestivalGearSetupForm";
import { FestivalGearSetup } from "@/types/festival";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { generateStageGearPDF } from "@/utils/gearSetupPdfExport";
import { generateAndMergeFestivalPDFs } from "@/utils/pdf/festivalPdfGenerator";
import { PrintOptions, PrintOptionsDialog } from "@/components/festival/pdf/PrintOptionsDialog";

const FestivalGearManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [stages, setStages] = useState<number[]>([1]);
  const [maxStages, setMaxStages] = useState(1);
  const [selectedStage, setSelectedStage] = useState(1);
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [isCreateStageDialogOpen, setIsCreateStageDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintOptionsDialogOpen, setIsPrintOptionsDialogOpen] = useState(false);

  // Use our new realtime subscription hook
  useRealtimeSubscription([
    {
      table: "jobs",
      filter: `id=eq.${jobId}`,
      queryKey: ["job", jobId]
    },
    {
      table: "festival_gear_setups",
      filter: `job_id=eq.${jobId}`,
      queryKey: ["festival-gear", jobId, selectedDate]
    }
  ]);

  useEffect(() => {
    if (!jobId) return;

    const fetchJobDetails = async () => {
      try {
        const { data: jobData, error: jobError } = await supabase
          .from("jobs")
          .select("title, start_time, end_time")
          .eq("id", jobId)
          .single();

        if (jobError) throw jobError;

        setJobTitle(jobData.title);
        
        const startDate = new Date(jobData.start_time);
        const endDate = new Date(jobData.end_time);
        
        if (startDate && endDate) {
          const dates = [];
          let currentDate = new Date(startDate);
          
          while (currentDate <= endDate) {
            dates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
          }
          
          setJobDates(dates);
          if (dates.length > 0) {
            setSelectedDate(format(dates[0], 'yyyy-MM-dd'));
          }
        }
      } catch (error) {
        console.error("Error fetching job details:", error);
        toast({
          title: "Error",
          description: "Could not load festival details",
          variant: "destructive",
        });
      }
    };

    const fetchFestivalGearSetup = async () => {
      try {
        const { data: setupData, error: setupError } = await supabase
          .from("festival_gear_setups")
          .select("*")
          .eq("job_id", jobId)
          .eq("date", selectedDate)
          .maybeSingle();

        if (setupError) throw setupError;
        
        if (setupData) {
          setGearSetup(setupData);
          setMaxStages(setupData.max_stages || 1);
          const stagesArray = Array.from({ length: setupData.max_stages || 1 }, (_, i) => i + 1);
          setStages(stagesArray);
        } else {
          setGearSetup(null);
          setMaxStages(1);
          setStages([1]);
        }
      } catch (error) {
        console.error("Error fetching festival gear setup:", error);
        toast({
          title: "Error",
          description: "Could not load festival gear setup",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchJobDetails();
    if (selectedDate) {
      fetchFestivalGearSetup();
    }
  }, [jobId, selectedDate, toast]);

  const handleUpdateMaxStages = async (newMaxStages: number) => {
    try {
      setIsLoading(true);
      
      const { error } = await supabase
        .from("festival_gear_setups")
        .upsert({
          job_id: jobId,
          date: selectedDate,
          max_stages: newMaxStages
        }, {
          onConflict: 'job_id,date'
        });

      if (error) throw error;

      setMaxStages(newMaxStages);
      const stagesArray = Array.from({ length: newMaxStages }, (_, i) => i + 1);
      setStages(stagesArray);
      
      toast({
        title: "Success",
        description: `Updated to ${newMaxStages} stages`,
      });
    } catch (error: any) {
      console.error("Error updating max stages:", error);
      toast({
        title: "Error",
        description: "Could not update stages configuration",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddStage = () => {
    handleUpdateMaxStages(maxStages + 1);
  };

  const handleSave = () => {
    toast({
      title: "Success",
      description: "Festival gear setup has been updated.",
    });
  };

  const handlePrintGearSetup = async () => {
    if (!jobId || !selectedDate) return;
    
    setIsPrinting(true);
    try {
      console.log(`Generating PDF for Stage ${selectedStage} on ${selectedDate}`);
      const pdf = await generateStageGearPDF(
        jobId, 
        selectedStage, 
        `Stage ${selectedStage}`
      );
      
      if (!pdf || pdf.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(pdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle}_Stage${selectedStage}_GearSetup.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: 'Gear setup documentation generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating gear setup PDF:', error);
      toast({
        title: "Error",
        description: `Failed to generate documentation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintAllDocumentation = async (options: PrintOptions) => {
    if (!jobId) return;
    
    setIsPrinting(true);
    try {
      console.log("Starting documentation print process with options:", options);
      
      const mergedPdf = await generateAndMergeFestivalPDFs(jobId, jobTitle || 'Festival', options);
      
      console.log(`Merged PDF created, size: ${mergedPdf.size} bytes`);
      if (!mergedPdf || mergedPdf.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(mergedPdf);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${jobTitle || 'Festival'}_Documentation.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Success",
        description: 'Documentation generated successfully'
      });
    } catch (error: any) {
      console.error('Error generating documentation:', error);
      toast({
        title: "Error",
        description: `Failed to generate documentation: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => navigate(`/festival-management/${jobId}`)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Festival Management
        </Button>
        <div className="text-right flex flex-col items-end">
          <h1 className="text-2xl font-bold">{jobTitle}</h1>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground">Gear Management</p>
            <ConnectionIndicator variant="icon" />
          </div>
        </div>
      </div>

      {jobDates.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Festival Dates</CardTitle>
                <CardDescription>Select a date to configure gear</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={selectedDate}
              onValueChange={setSelectedDate}
              className="w-full"
            >
              <TabsList className="mb-4 flex flex-wrap">
                {jobDates.map((date) => (
                  <TabsTrigger
                    key={format(date, 'yyyy-MM-dd')}
                    value={format(date, 'yyyy-MM-dd')}
                  >
                    {format(date, 'EEE, MMM d')}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {selectedDate && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Stages Configuration</CardTitle>
              <Button onClick={handleAddStage} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Stage
              </Button>
            </div>
            <CardDescription>
              Configure the number of stages for {format(new Date(selectedDate), 'MMMM d, yyyy')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {stages.map((stage) => (
                <Button
                  key={stage}
                  variant={selectedStage === stage ? "default" : "outline"}
                  onClick={() => setSelectedStage(stage)}
                  className="px-6"
                >
                  Stage {stage}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedDate && !isLoading && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Stage {selectedStage} Gear Setup
              </CardTitle>
              <Button 
                onClick={handlePrintGearSetup} 
                disabled={isPrinting}
                variant="outline"
              >
                {isPrinting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                Print Gear Setup
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Alert>
                <AlertDescription>
                  Configure the gear setup for Stage {selectedStage}. This information will be used when artists submit their technical requirements.
                </AlertDescription>
              </Alert>
            </div>
            <FestivalGearSetupForm
              jobId={jobId || ''}
              selectedDate={selectedDate}
              stageNumber={selectedStage}
              onSave={handleSave}
            />
          </CardContent>
        </Card>
      )}

      <Dialog open={isCreateStageDialogOpen} onOpenChange={setIsCreateStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Stage</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Stage Name
              </Label>
              <Input
                id="name"
                value={newStageName}
                onChange={(e) => setNewStageName(e.target.value)}
                className="col-span-3"
                placeholder="Main Stage"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              onClick={() => {
                handleAddStage();
                setIsCreateStageDialogOpen(false);
              }}
            >
              Add Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isPrintOptionsDialogOpen && (
        <PrintOptionsDialog
          open={isPrintOptionsDialogOpen}
          onOpenChange={setIsPrintOptionsDialogOpen}
          onConfirm={handlePrintAllDocumentation}
          maxStages={maxStages}
        />
      )}
    </div>
  );
};

export default FestivalGearManagement;
