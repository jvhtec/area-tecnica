
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Save, Upload } from "lucide-react";
import { GearSetupFormData } from "@/types/festival-gear";
import { StageGearSetup } from "@/types/festival";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { WirelessSetupSection } from "./form/sections/WirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MicrophoneNeedsCalculator } from "./gear-setup/MicrophoneNeedsCalculator";
import { FestivalConsoleSetupSection } from "./form/sections/FestivalConsoleSetupSection";
import { FestivalMicKitConfig } from "./gear-setup/FestivalMicKitConfig";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { PushToFlexPullsheetDialog } from "./PushToFlexPullsheetDialog";

interface FestivalGearSetupFormProps {
  jobId: string;
  stageNumber?: number;
  onSave?: () => void;
}

export const FestivalGearSetupForm = ({
  jobId,
  stageNumber = 1,
  onSave
}: FestivalGearSetupFormProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [setup, setSetup] = useState<GearSetupFormData>({
    max_stages: 1,
    foh_consoles: [],
    mon_consoles: [],
    wireless_systems: [],
    iem_systems: [],
    wired_mics: [],
    monitors_enabled: false,
    monitors_quantity: 0,
    extras_sf: false,
    extras_df: false,
    extras_djbooth: false,
    extras_wired: "",
    infra_cat6: false,
    infra_cat6_quantity: 0,
    infra_hma: false,
    infra_hma_quantity: 0,
    infra_coax: false,
    infra_coax_quantity: 0,
    infra_opticalcon_duo: false,
    infra_opticalcon_duo_quantity: 0,
    infra_analog: 0,
    other_infrastructure: "",
    notes: "",
  });
  const [globalSetup, setGlobalSetup] = useState(null);
  const [existingSetupId, setExistingSetupId] = useState<string | null>(null);
  const [stageSetupId, setStageSetupId] = useState<string | null>(null);
  const [hasStageSpecificSetup, setHasStageSpecificSetup] = useState(false);
  const [showPushDialog, setShowPushDialog] = useState(false);
  const isPrimaryStage = stageNumber === 1;

  useEffect(() => {
    const fetchExistingSetup = async () => {
      try {
        setIsLoading(true);
        
        // Fetch the main gear setup (no date filter needed)
        const { data: setupData, error: setupError } = await supabase
          .from('festival_gear_setups')
          .select('*')
          .eq('job_id', jobId)
          .single();

        if (setupError) {
          // If the error is not a "not found" error, throw it
          if (setupError.code !== 'PGRST116') {
            throw setupError;
          }
          // If the setup doesn't exist, reset the form
          console.log('No existing setup found');
          setExistingSetupId(null);
          setGlobalSetup(null);
          setStageSetupId(null);
          setHasStageSpecificSetup(false);
          return;
        }
        
        if (setupData) {
          console.log('Found existing global setup:', setupData);
          console.log('Global setup wired_mics:', setupData.wired_mics);
          // Store the gear setup for validation purposes
          setGlobalSetup(setupData);
          setExistingSetupId(setupData.id);
          
          // For non-primary stages, check for stage-specific setup
          if (!isPrimaryStage) {
            const { data: stageSetupData, error: stageError } = await supabase
              .from('festival_stage_gear_setups')
              .select('*')
              .eq('gear_setup_id', setupData.id)
              .eq('stage_number', stageNumber)
              .maybeSingle();
              
            if (stageError) {
              console.error('Error fetching stage setup:', stageError);
            }
            
            // If we found a stage-specific setup, use its values
            if (stageSetupData) {
              console.log('Found existing stage setup:', stageSetupData);
              console.log('Stage setup wired_mics:', stageSetupData.wired_mics);
              setStageSetupId(stageSetupData.id);
              setHasStageSpecificSetup(true);
              
              // Update form with stage-specific data
              setSetup({
                max_stages: setupData.max_stages || 1,
                foh_consoles: stageSetupData.foh_consoles || [],
                mon_consoles: stageSetupData.mon_consoles || [],
                wireless_systems: stageSetupData.wireless_systems || [],
                iem_systems: stageSetupData.iem_systems || [],
                wired_mics: stageSetupData.wired_mics || [],
                monitors_enabled: stageSetupData.monitors_enabled || false,
                monitors_quantity: stageSetupData.monitors_quantity || 0,
                extras_sf: stageSetupData.extras_sf || false,
                extras_df: stageSetupData.extras_df || false,
                extras_djbooth: stageSetupData.extras_djbooth || false,
                extras_wired: stageSetupData.extras_wired || "",
                infra_cat6: stageSetupData.infra_cat6 || false,
                infra_cat6_quantity: stageSetupData.infra_cat6_quantity || 0,
                infra_hma: stageSetupData.infra_hma || false,
                infra_hma_quantity: stageSetupData.infra_hma_quantity || 0,
                infra_coax: stageSetupData.infra_coax || false,
                infra_coax_quantity: stageSetupData.infra_coax_quantity || 0,
                infra_opticalcon_duo: stageSetupData.infra_opticalcon_duo || false,
                infra_opticalcon_duo_quantity: stageSetupData.infra_opticalcon_duo_quantity || 0,
                infra_analog: stageSetupData.infra_analog || 0,
                other_infrastructure: stageSetupData.other_infrastructure || "",
                notes: stageSetupData.notes || ""
              });
            } else {
              // For non-primary stage without stage-specific setup, use global setup data
              setHasStageSpecificSetup(false);
              
              // Update form values with global data
              setSetup({
                max_stages: setupData.max_stages || 1,
                foh_consoles: setupData.foh_consoles || [],
                mon_consoles: setupData.mon_consoles || [],
                wireless_systems: setupData.wireless_systems || [],
                iem_systems: setupData.iem_systems || [],
                wired_mics: setupData.wired_mics || [],
                monitors_enabled: setupData.available_monitors > 0,
                monitors_quantity: setupData.available_monitors || 0,
                extras_sf: setupData.has_side_fills || false,
                extras_df: setupData.has_drum_fills || false,
                extras_djbooth: setupData.has_dj_booths || false,
                extras_wired: setupData.extras_wired || "",
                infra_cat6: setupData.available_cat6_runs > 0,
                infra_cat6_quantity: setupData.available_cat6_runs || 0,
                infra_hma: setupData.available_hma_runs > 0,
                infra_hma_quantity: setupData.available_hma_runs || 0,
                infra_coax: setupData.available_coax_runs > 0,
                infra_coax_quantity: setupData.available_coax_runs || 0,
                infra_opticalcon_duo: setupData.available_opticalcon_duo_runs > 0,
                infra_opticalcon_duo_quantity: setupData.available_opticalcon_duo_runs || 0,
                infra_analog: setupData.available_analog_runs || 0,
                other_infrastructure: setupData.other_infrastructure || "",
                notes: setupData.notes || ""
              });
            }
          } else {
            // For primary stage (stage 1), always use global setup directly
            setHasStageSpecificSetup(false);
            
            // Update form values with global data
            setSetup({
              max_stages: setupData.max_stages || 1,
              foh_consoles: setupData.foh_consoles || [],
              mon_consoles: setupData.mon_consoles || [],
              wireless_systems: setupData.wireless_systems || [],
              iem_systems: setupData.iem_systems || [],
              wired_mics: setupData.wired_mics || [],
              monitors_enabled: setupData.available_monitors > 0,
              monitors_quantity: setupData.available_monitors || 0,
              extras_sf: setupData.has_side_fills || false,
              extras_df: setupData.has_drum_fills || false,
              extras_djbooth: setupData.has_dj_booths || false,
              extras_wired: setupData.extras_wired || "",
              infra_cat6: setupData.available_cat6_runs > 0,
              infra_cat6_quantity: setupData.available_cat6_runs || 0,
              infra_hma: setupData.available_hma_runs > 0,
              infra_hma_quantity: setupData.available_hma_runs || 0,
              infra_coax: setupData.available_coax_runs > 0,
              infra_coax_quantity: setupData.available_coax_runs || 0,
              infra_opticalcon_duo: setupData.available_opticalcon_duo_runs > 0,
              infra_opticalcon_duo_quantity: setupData.available_opticalcon_duo_runs || 0,
              infra_analog: setupData.available_analog_runs || 0,
              other_infrastructure: setupData.other_infrastructure || "",
              notes: setupData.notes || ""
            });
          }
        }
      } catch (error) {
        console.error('Error fetching festival gear setup:', error);
        toast({
          title: "Error",
          description: "Error al cargar la configuración de equipamiento.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (jobId) {
      fetchExistingSetup();
    }
  }, [jobId, stageNumber, toast, isPrimaryStage]);

  const handleChange = (changes: Partial<GearSetupFormData>) => {
    console.log('=== HANDLE CHANGE DEBUG ===');
    console.log('Changes received:', changes);
    console.log('Current setup wired_mics before change:', setup.wired_mics);
    console.log('New wired_mics in changes:', changes.wired_mics);

    setSetup(prev => {
      const newSetup = { ...prev, ...changes };
      console.log('New setup wired_mics after merge:', newSetup.wired_mics);
      console.log('Full new setup:', newSetup);
      return newSetup;
    });
  };

  const handlePushToFlex = () => {
    if (!existingSetupId) {
      toast({
        title: "Configuración no guardada",
        description: "Por favor guarda la configuración de equipamiento antes de enviar a Flex.",
        variant: "destructive"
      });
      return;
    }
    setShowPushDialog(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      console.log('=== FORM SUBMIT DEBUG ===');
      console.log('Current setup state:', setup);
      console.log('setup.wired_mics before save:', setup.wired_mics);
      console.log('wired_mics array length:', setup.wired_mics?.length || 0);
      console.log('wired_mics detailed:', JSON.stringify(setup.wired_mics, null, 2));
      
      if (!jobId) throw new Error('No job ID provided');
      
      // Ensure wired_mics is always an array and properly serialized
      const sanitizedWiredMics = Array.isArray(setup.wired_mics) ? setup.wired_mics : [];
      console.log('Sanitized wired_mics for save:', sanitizedWiredMics);
      
      // STEP 1: For primary stage (stage 1), always update the global setup
      if (isPrimaryStage) {
        const setupPayload = {
          job_id: jobId,
          max_stages: setup.max_stages,
          foh_consoles: setup.foh_consoles,
          mon_consoles: setup.mon_consoles,
          wireless_systems: setup.wireless_systems,
          iem_systems: setup.iem_systems,
          wired_mics: sanitizedWiredMics, // Use sanitized version
          has_side_fills: setup.extras_sf,
          has_drum_fills: setup.extras_df,
          has_dj_booths: setup.extras_djbooth,
          extras_wired: setup.extras_wired,
          available_monitors: setup.monitors_enabled ? setup.monitors_quantity : 0,
          available_cat6_runs: setup.infra_cat6 ? setup.infra_cat6_quantity : 0,
          available_hma_runs: setup.infra_hma ? setup.infra_hma_quantity : 0,
          available_coax_runs: setup.infra_coax ? setup.infra_coax_quantity : 0,
          available_opticalcon_duo_runs: setup.infra_opticalcon_duo ? setup.infra_opticalcon_duo_quantity : 0,
          available_analog_runs: setup.infra_analog,
          other_infrastructure: setup.other_infrastructure,
          notes: setup.notes
        };

        // Add the ID for updates if we have an existing setup
        if (existingSetupId) {
          setupPayload['id'] = existingSetupId;
        }

        console.log('=== PAYLOAD DEBUG ===');
        console.log('Payload for global setup save:', setupPayload);
        console.log('Payload wired_mics:', setupPayload.wired_mics);
        console.log('Payload wired_mics type:', typeof setupPayload.wired_mics);
        console.log('Payload wired_mics serialized:', JSON.stringify(setupPayload.wired_mics, null, 2));

        // Upsert the global setup
        const { data: globalData, error: globalError } = await supabase
          .from('festival_gear_setups')
          .upsert(setupPayload, { 
            onConflict: 'job_id' 
          })
          .select();

        if (globalError) {
          console.error('Upsert error for global setup:', globalError);
          throw globalError;
        }

        console.log('=== SAVE RESPONSE DEBUG ===');
        console.log('Saved global setup response:', globalData);
        console.log('Saved global setup wired_mics:', globalData?.[0]?.wired_mics);
        console.log('Saved global setup wired_mics type:', typeof globalData?.[0]?.wired_mics);
        
        // Update the existingSetupId with the new ID if this was a new record
        if (globalData && globalData.length > 0) {
          setExistingSetupId(globalData[0].id);
          setGlobalSetup(globalData[0]);
        }
      } else {
        // For non-primary stages, we need to make sure the global setup exists first
        let globalSetupId = existingSetupId;
        
        if (!globalSetupId) {
          // Create a basic global setup if it doesn't exist
          const basicGlobalSetup = {
            job_id: jobId,
            max_stages: Math.max(setup.max_stages, stageNumber || 1)
          };
          
          const { data: newGlobalSetup, error: newGlobalError } = await supabase
            .from('festival_gear_setups')
            .upsert(basicGlobalSetup, { 
              onConflict: 'job_id' 
            })
            .select();
            
          if (newGlobalError) {
            console.error('Error creating global setup:', newGlobalError);
            throw newGlobalError;
          }
          
          globalSetupId = newGlobalSetup[0].id;
          setExistingSetupId(globalSetupId);
          setGlobalSetup(newGlobalSetup[0]);
        } else {
          // Update only the max_stages on the global setup if needed
          const { error: updateMaxStagesError } = await supabase
            .from('festival_gear_setups')
            .update({
              max_stages: Math.max(globalSetup?.max_stages || 1, stageNumber)
            })
            .eq('id', globalSetupId);
            
          if (updateMaxStagesError) {
            console.error('Error updating max stages:', updateMaxStagesError);
            // Non-critical error, continue with stage setup
          }
        }
        
        // STEP 2: For non-primary stages, create/update stage-specific setup
        const stagePayload = {
          gear_setup_id: globalSetupId,
          stage_number: stageNumber,
          foh_consoles: setup.foh_consoles,
          mon_consoles: setup.mon_consoles,
          wireless_systems: setup.wireless_systems,
          iem_systems: setup.iem_systems,
          wired_mics: sanitizedWiredMics, // Use sanitized version
          monitors_enabled: setup.monitors_enabled,
          monitors_quantity: setup.monitors_quantity,
          extras_sf: setup.extras_sf,
          extras_df: setup.extras_df,
          extras_djbooth: setup.extras_djbooth,
          extras_wired: setup.extras_wired,
          infra_cat6: setup.infra_cat6,
          infra_cat6_quantity: setup.infra_cat6_quantity,
          infra_hma: setup.infra_hma,
          infra_hma_quantity: setup.infra_hma_quantity,
          infra_coax: setup.infra_coax,
          infra_coax_quantity: setup.infra_coax_quantity,
          infra_opticalcon_duo: setup.infra_opticalcon_duo,
          infra_opticalcon_duo_quantity: setup.infra_opticalcon_duo_quantity,
          infra_analog: setup.infra_analog,
          other_infrastructure: setup.other_infrastructure,
          notes: setup.notes
        };
        
        // Add ID if we're updating an existing stage setup
        if (stageSetupId) {
          stagePayload['id'] = stageSetupId;
        }
        
        console.log('=== STAGE PAYLOAD DEBUG ===');
        console.log('Payload for stage setup save:', stagePayload);
        console.log('Stage payload wired_mics:', stagePayload.wired_mics);
        console.log('Stage payload wired_mics type:', typeof stagePayload.wired_mics);
        
        // Upsert the stage setup
        const { data: stageData, error: stageError } = await supabase
          .from('festival_stage_gear_setups')
          .upsert(stagePayload)
          .select();
        
        if (stageError) {
          console.error('Upsert error for stage setup:', stageError);
          throw stageError;
        }
        
        console.log('=== STAGE SAVE RESPONSE DEBUG ===');
        console.log('Saved stage setup response:', stageData);
        console.log('Saved stage setup wired_mics:', stageData?.[0]?.wired_mics);
        
        // Update the stage setup ID state
        if (stageData && stageData.length > 0) {
          setStageSetupId(stageData[0].id);
          setHasStageSpecificSetup(true);
        }
      }

      onSave?.();
      toast({
        title: "Éxito",
        description: isPrimaryStage
          ? "La configuración de equipamiento global ha sido guardada."
          : `La configuración de Stage ${stageNumber} ha sido guardada.`,
      });
    } catch (error) {
      console.error('Error saving festival gear setup:', error);
      toast({
        title: "Error",
        description: "Error al guardar la configuración de equipamiento del festival.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const alertText = isPrimaryStage
    ? "Está editando la configuración de stage predeterminada. Esta configuración se utilizará como predeterminada para todos los stages."
    : hasStageSpecificSetup
      ? `Este stage tiene una configuración de equipamiento personalizada que difiere de la configuración global.`
      : `Este stage está usando actualmente la configuración global. Cualquier cambio creará una configuración personalizada para Stage ${stageNumber}.`;

  const alertVariant = isPrimaryStage ? "default" : hasStageSpecificSetup ? "info" : "default";

  // Create a compatible form data object for the sections
  const getCompatibleFormData = () => ({
    ...setup,
    name: "",
    stage: stageNumber,
    date: "",
    show_start: "",
    show_end: "",
    soundcheck: false,
    foh_console: "",
    foh_console_provided_by: "",
    mon_console: "",
    mon_console_provided_by: "",
    wireless_provided_by: "",
    iem_provided_by: "",  
    infrastructure_provided_by: "",
    foh_tech: false,
    mon_tech: false,
    rider_missing: false,
    isaftermidnight: false,
    mic_kit: "band" as const,
    wired_mics: []
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6 md:space-y-8">
      <Alert variant={alertVariant} className={isPrimaryStage ? "bg-yellow-50" : hasStageSpecificSetup ? "bg-blue-50" : "bg-gray-50"}>
        <AlertDescription className="text-sm">
          {alertText}
        </AlertDescription>
      </Alert>
      
      {/* Desktop Layout - Always visible */}
      <div className="hidden md:block space-y-8">
        <FestivalConsoleSetupSection
          formData={setup}
          onChange={(changes) => handleChange(changes)}
        />

        <WirelessSetupSection
          formData={getCompatibleFormData()}
          onChange={(changes) => handleChange(changes)}
        />

        <FestivalMicKitConfig
          jobId={jobId}
          stageNumber={stageNumber}
          wiredMics={setup.wired_mics}
          onChange={(wiredMics) => {
            console.log('FestivalMicKitConfig onChange called with:', wiredMics);
            handleChange({ wired_mics: wiredMics });
          }}
        />

        <MonitorSetupSection
          formData={getCompatibleFormData()}
          onChange={(changes) => handleChange(changes)}
          gearSetup={globalSetup}
        />

        <ExtraRequirementsSection
          formData={getCompatibleFormData()}
          onChange={(changes) => handleChange(changes)}
          gearSetup={globalSetup}
        />

        <InfrastructureSection
          formData={getCompatibleFormData()}
          onChange={(changes) => handleChange(changes)}
          gearSetup={globalSetup}
        />

        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Análisis de Requisitos de Micrófonos</h3>
          <p className="text-sm text-muted-foreground">
            Calcule las necesidades de micrófonos cableados basándose en los requisitos de los artistas y los horarios de shows.
          </p>
          <MicrophoneNeedsCalculator jobId={jobId} />
        </div>

        <NotesSection
          formData={getCompatibleFormData()}
          onChange={(changes) => handleChange(changes)}
        />
      </div>

      {/* Mobile Layout - Accordion */}
      <div className="md:hidden">
        <Accordion type="multiple" defaultValue={["consoles", "wireless"]} className="space-y-4">
          <AccordionItem value="consoles" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Configuración de Console
            </AccordionTrigger>
            <AccordionContent>
              <FestivalConsoleSetupSection
                formData={setup}
                onChange={(changes) => handleChange(changes)}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="wireless" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Configuración de Wireless
            </AccordionTrigger>
            <AccordionContent>
              <WirelessSetupSection
                formData={getCompatibleFormData()}
                onChange={(changes) => handleChange(changes)}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mics" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Kit de Micrófonos
            </AccordionTrigger>
            <AccordionContent>
              <FestivalMicKitConfig
                jobId={jobId}
                stageNumber={stageNumber}
                wiredMics={setup.wired_mics}
                onChange={(wiredMics) => {
                  console.log('FestivalMicKitConfig onChange called with:', wiredMics);
                  handleChange({ wired_mics: wiredMics });
                }}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="monitors" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Configuración de Monitor
            </AccordionTrigger>
            <AccordionContent>
              <MonitorSetupSection
                formData={getCompatibleFormData()}
                onChange={(changes) => handleChange(changes)}
                gearSetup={globalSetup}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="extras" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Requisitos Adicionales
            </AccordionTrigger>
            <AccordionContent>
              <ExtraRequirementsSection
                formData={getCompatibleFormData()}
                onChange={(changes) => handleChange(changes)}
                gearSetup={globalSetup}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="infrastructure" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Infraestructura
            </AccordionTrigger>
            <AccordionContent>
              <InfrastructureSection
                formData={getCompatibleFormData()}
                onChange={(changes) => handleChange(changes)}
                gearSetup={globalSetup}
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="analysis" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Análisis de Micrófonos
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Calcule las necesidades de micrófonos cableados basándose en los requisitos de los artistas y los horarios de shows.
                </p>
                <MicrophoneNeedsCalculator jobId={jobId} />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="notes" className="border rounded-lg px-4">
            <AccordionTrigger className="text-base font-semibold hover:no-underline">
              Notas
            </AccordionTrigger>
            <AccordionContent>
              <NotesSection
                formData={getCompatibleFormData()}
                onChange={(changes) => handleChange(changes)}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handlePushToFlex}
          disabled={!existingSetupId || isLoading}
          className="flex-1"
        >
          <Upload className="h-4 w-4 mr-2" />
          Push to Flex Pullsheet
        </Button>

        <Button type="submit" disabled={isLoading} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {isLoading ? "Guardando..." : (
            isPrimaryStage
              ? "Guardar Configuración Global"
              : hasStageSpecificSetup
                ? `Actualizar Configuración de Stage ${stageNumber}`
                : `Crear Configuración Personalizada para Stage ${stageNumber}`
          )}
        </Button>
      </div>

      <PushToFlexPullsheetDialog
        open={showPushDialog}
        onOpenChange={setShowPushDialog}
        gearSetup={setup}
        jobId={jobId}
      />
    </form>
  );
};
