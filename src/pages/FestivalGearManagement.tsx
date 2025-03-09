
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Copy, Save, Wrench } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { FestivalGearSetupForm } from "@/components/festival/FestivalGearSetupForm";
import { FestivalGearSetup } from "@/types/festival";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
        // First, check if we have a setup for this date
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
          // Generate stages array based on max_stages
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
      
      // Update or create the gear setup with new max_stages
      const { error } = await supabase
        .from("festival_gear_setups")
        .upsert({
          job_id: jobId,
          date: selectedDate,
          max_stages: newMaxStages
        });

      if (error) throw error;

      // Update local state
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
        <div className="text-right">
          <h1 className="text-2xl font-bold">{jobTitle}</h1>
          <p className="text-muted-foreground">Gear Management</p>
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
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Stage {selectedStage} Gear Setup
            </CardTitle>
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
                // Add stage logic would go here
                handleAddStage();
                setIsCreateStageDialogOpen(false);
              }}
            >
              Add Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FestivalGearManagement;
