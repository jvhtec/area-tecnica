import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Copy, Save, Wrench, Printer, Loader2, Calendar, Edit2, Check, X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StageInfo {
  id?: string;
  number: number;
  name: string;
}

const FestivalGearManagement = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [jobTitle, setJobTitle] = useState("");
  const [jobDates, setJobDates] = useState<Date[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [stages, setStages] = useState<StageInfo[]>([{ number: 1, name: "Stage 1" }]);
  const [maxStages, setMaxStages] = useState(1);
  const [selectedStage, setSelectedStage] = useState(1);
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [isCreateStageDialogOpen, setIsCreateStageDialogOpen] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintOptionsDialogOpen, setIsPrintOptionsDialogOpen] = useState(false);
  const [stageSetups, setStageSetups] = useState<Record<number, boolean>>({});

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
    },
    {
      table: "festival_stages",
      filter: `job_id=eq.${jobId}`,
      queryKey: ["festival-stages", jobId]
    }
  ]);

  // Consolidated function to fetch and sync all stage data
  const fetchAndSyncStageData = async (currentMaxStages?: number) => {
    if (!jobId) return;
    
    try {
      console.log("=== FETCHING AND SYNCING STAGE DATA ===");
      
      // Get current max_stages from gear setup if not provided
      let actualMaxStages = currentMaxStages;
      if (!actualMaxStages) {
        const { data: setupData } = await supabase
          .from("festival_gear_setups")
          .select("max_stages")
          .eq("job_id", jobId)
          .eq("date", selectedDate)
          .maybeSingle();
        
        actualMaxStages = setupData?.max_stages || 1;
      }
      
      console.log(`Current max_stages: ${actualMaxStages}`);
      
      // Ensure all stage records exist (1 through max_stages)
      const stagesToCreate = [];
      for (let i = 1; i <= actualMaxStages; i++) {
        stagesToCreate.push({
          job_id: jobId,
          number: i,
          name: `Stage ${i}`
        });
      }
      
      if (stagesToCreate.length > 0) {
        console.log("Upserting stage records:", stagesToCreate);
        
        // Use upsert to create or update stage records
        const { error: upsertError } = await supabase
          .from("festival_stages")
          .upsert(stagesToCreate, {
            onConflict: 'job_id,number',
            ignoreDuplicates: false
          });
        
        if (upsertError) {
          console.error("Error upserting stage records:", upsertError);
        } else {
          console.log("Successfully upserted stage records");
        }
      }
      
      // Now fetch the current stage data from database
      const { data: stageData, error: stageError } = await supabase
        .from("festival_stages")
        .select("id, number, name")
        .eq("job_id", jobId)
        .order("number");

      if (stageError) {
        console.error("Error fetching stages:", stageError);
        return;
      }

      if (stageData && stageData.length > 0) {
        const stageInfo = stageData.map(stage => ({
          id: stage.id,
          number: stage.number,
          name: stage.name || `Stage ${stage.number}`
        }));
        
        console.log("Setting stages from database:", stageInfo);
        setStages(stageInfo);
        setMaxStages(actualMaxStages);
      }
      
    } catch (error) {
      console.error("Error in fetchAndSyncStageData:", error);
    }
  };

  // Initial data loading
  useEffect(() => {
    if (!jobId) return;

    const initializeData = async () => {
      try {
        setIsLoading(true);
        
        // Fetch job details
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
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, [jobId, toast]);

  // Sync stage data when selectedDate changes
  useEffect(() => {
    if (!selectedDate || !jobId) return;
    
    const loadGearSetupAndStages = async () => {
      try {
        // Fetch gear setup to get max_stages
        const { data: setupData, error: setupError } = await supabase
          .from("festival_gear_setups")
          .select("*")
          .eq("job_id", jobId)
          .eq("date", selectedDate)
          .maybeSingle();

        if (setupError) throw setupError;
        
        if (setupData) {
          setGearSetup(setupData);
          const setupMaxStages = setupData.max_stages || 1;
          
          console.log(`Gear setup loaded with max_stages: ${setupMaxStages}`);
          
          // Fetch and sync stage data with this max_stages
          await fetchAndSyncStageData(setupMaxStages);
        } else {
          setGearSetup(null);
          // Even if no gear setup exists, ensure we have at least stage 1
          await fetchAndSyncStageData(1);
        }
      } catch (error) {
        console.error("Error loading gear setup and stages:", error);
        toast({
          title: "Error",
          description: "Could not load festival gear setup",
          variant: "destructive",
        });
      }
    };

    loadGearSetupAndStages();
  }, [selectedDate, jobId, toast]);

  // Fetch stage setups to show custom badges
  const fetchStageSetups = async () => {
    if (!selectedDate || !jobId) return;
    
    try {
      const { data: gearSetup, error: gearError } = await supabase
        .from("festival_gear_setups")
        .select("id")
        .eq("job_id", jobId)
        .eq("date", selectedDate)
        .maybeSingle();
        
      if (gearError) {
        console.error("Error fetching gear setup ID:", gearError);
        return;
      }
      
      if (!gearSetup) return;
      
      const { data: stageSetupData, error: stageError } = await supabase
        .from("festival_stage_gear_setups")
        .select("stage_number")
        .eq("gear_setup_id", gearSetup.id);
        
      if (stageError) {
        console.error("Error fetching stage setups:", stageError);
        return;
      }
      
      const setupMap = stageSetupData.reduce((acc, item) => {
        acc[item.stage_number] = true;
        return acc;
      }, {});
      
      setStageSetups(setupMap);
    } catch (error) {
      console.error("Error checking stage setups:", error);
    }
  };

  useEffect(() => {
    fetchStageSetups();
  }, [selectedDate, jobId]);

  const handleUpdateMaxStages = async (newMaxStages: number) => {
    try {
      setIsLoading(true);
      
      console.log(`=== UPDATING MAX STAGES TO ${newMaxStages} ===`);
      
      // First update or create the gear setup with new max_stages
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

      // Fetch and sync stage data with the new max_stages
      await fetchAndSyncStageData(newMaxStages);
      
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
    if (newStageName.trim()) {
      handleUpdateMaxStages(maxStages + 1);
      setNewStageName("");
      setIsCreateStageDialogOpen(false);
    } else {
      handleUpdateMaxStages(maxStages + 1);
    }
  };

  const handleStartEditStage = (stageNumber: number) => {
    const stage = stages.find(s => s.number === stageNumber);
    setEditingStage(stageNumber);
    setEditingStageName(stage?.name || `Stage ${stageNumber}`);
  };

  const handleSaveStageEdit = async () => {
    if (!editingStage || !editingStageName.trim()) {
      console.log("Save cancelled: missing stage number or name");
      setEditingStage(null);
      setEditingStageName("");
      return;
    }

    try {
      console.log(`=== SAVING STAGE EDIT: Stage ${editingStage} -> "${editingStageName.trim()}" ===`);
      
      // Update the stage name in database
      const { data, error } = await supabase
        .from("festival_stages")
        .update({ name: editingStageName.trim() })
        .eq("job_id", jobId)
        .eq("number", editingStage)
        .select();

      if (error) {
        console.error("Database error saving stage:", error);
        throw error;
      }

      console.log("Stage save successful:", data);

      // Immediately update local state to reflect the change
      setStages(prev => prev.map(stage => 
        stage.number === editingStage 
          ? { ...stage, name: editingStageName.trim() }
          : stage
      ));

      // Clear editing state
      setEditingStage(null);
      setEditingStageName("");

      toast({
        title: "Success",
        description: "Stage name updated",
      });
    } catch (error) {
      console.error("Error updating stage name:", error);
      toast({
        title: "Error",
        description: "Could not update stage name",
        variant: "destructive",
      });
      
      // Still clear editing state even on error
      setEditingStage(null);
      setEditingStageName("");
    }
  };

  const handleCancelStageEdit = () => {
    setEditingStage(null);
    setEditingStageName("");
  };

  const getCurrentStageName = (stageNumber: number) => {
    const stage = stages.find(s => s.number === stageNumber);
    return stage?.name || `Stage ${stageNumber}`;
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

  const handlePrintAllDocumentation = async (options: PrintOptions, filename: string) => {
    if (!jobId) return;
    
    setIsPrinting(true);
    try {
      console.log("Starting documentation print process with options:", options);
      
      const result = await generateAndMergeFestivalPDFs(jobId, jobTitle || 'Festival', options, filename);
      
      console.log(`Merged PDF created, size: ${result.blob.size} bytes`);
      if (!result.blob || result.blob.size === 0) {
        throw new Error('Generated PDF is empty');
      }
      
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
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
                <CardTitle>Festival Date</CardTitle>
                <CardDescription>Select a date to configure gear</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedDate} onValueChange={setSelectedDate}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select date" />
                </SelectTrigger>
                <SelectContent>
                  {jobDates.map((date) => (
                    <SelectItem
                      key={format(date, 'yyyy-MM-dd')}
                      value={format(date, 'yyyy-MM-dd')}
                    >
                      {format(date, 'EEE, MMM d, yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedDate && (
                <div className="text-sm text-muted-foreground">
                  Configuring gear for {format(new Date(selectedDate), 'MMMM d, yyyy')}
                </div>
              )}
            </div>
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
              Configure the stages for {format(new Date(selectedDate), 'MMMM d, yyyy')}. Click on a stage name to edit it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {stages.map((stage) => (
                <div key={stage.number} className="relative">
                  <Button
                    variant={selectedStage === stage.number ? "default" : "outline"}
                    onClick={() => setSelectedStage(stage.number)}
                    className="px-6 flex items-center gap-2"
                  >
                    <span>{stage.name}</span>
                    {stageSetups[stage.number] && (
                      <Badge variant="outline" className="ml-2 bg-blue-100">
                        Custom
                      </Badge>
                    )}
                  </Button>
                  
                  {editingStage === stage.number ? (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-white border rounded-md shadow-lg z-10 min-w-[200px]">
                      <Input
                        value={editingStageName}
                        onChange={(e) => setEditingStageName(e.target.value)}
                        placeholder="Stage name"
                        className="mb-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveStageEdit();
                          if (e.key === 'Escape') handleCancelStageEdit();
                        }}
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={handleSaveStageEdit}>
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="outline" onClick={handleCancelStageEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute -top-1 -right-1 h-6 w-6 p-0"
                      onClick={() => handleStartEditStage(stage.number)}
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
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
                {getCurrentStageName(selectedStage)} Gear Setup
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
                  Configure the gear setup for {getCurrentStageName(selectedStage)}. This information will be used when artists submit their technical requirements.
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
          jobTitle={jobTitle}
        />
      )}
    </div>
  );
};

export default FestivalGearManagement;
