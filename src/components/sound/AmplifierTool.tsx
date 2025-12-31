import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateAmplifierPdf } from "@/utils/amplifierCalculationPdf";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";
import { soundComponentDatabase, sectionSpeakers, speakerAmplifierConfig, isTFSpeaker } from "./amplifier-tool/constants";
import type { AmplifierResults, SpeakerConfig, SpeakerSection } from "./amplifier-tool/types";
import { SpeakerSectionEditor } from "./amplifier-tool/SpeakerSectionEditor";
import { AmplifierResultsSummary } from "./amplifier-tool/AmplifierResultsSummary";
import { SaveResultsToPresetPanel } from "./amplifier-tool/SaveResultsToPresetPanel";

export interface AmplifierToolProps {
  jobId?: string;
  tourId?: string;
}

export const AmplifierTool = ({ jobId, tourId }: AmplifierToolProps = {}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Record<string, SpeakerSection>>({
    mains: { speakers: [], mirrored: false },
    outs: { speakers: [], mirrored: false },
    subs: { speakers: [] },
    fronts: { speakers: [] },
    delays: { speakers: [], mirrored: false },
    other: { speakers: [] }
  });

  const [results, setResults] = useState<AmplifierResults | null>(null);
  const [presetOptions, setPresetOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [ampOptions, setAmpOptions] = useState<Array<{ id: string; name: string; category: string | null }>>([]);
  const [laRakEquipmentId, setLaRakEquipmentId] = useState<string | null>(null);
  const [laAmpEquipmentId, setLaAmpEquipmentId] = useState<string | null>(null);
  const [plmRakEquipmentId, setPlmRakEquipmentId] = useState<string | null>(null);
  const [plmAmpEquipmentId, setPlmAmpEquipmentId] = useState<string | null>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isLoadingAmpOptions, setIsLoadingAmpOptions] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [speakerEquipmentMap, setSpeakerEquipmentMap] = useState<Map<string, string>>(new Map());
  const [createNewPreset, setCreateNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');

  useEffect(() => {
    let isMounted = true;

    const loadPresets = async () => {
      setIsLoadingPresets(true);
      try {
        const { data, error } = await supabase
          .from('presets')
          .select('id, name')
          .eq('department', 'sound')
          .order('name');

        if (error) throw error;
        if (!isMounted) return;

        const rows = (data || []) as Array<{ id: string; name: string }>;
        setPresetOptions(rows);
        setSelectedPresetId((current) => current || rows[0]?.id || '');
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load sound presets for amplifier tool', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar los presets de sonido.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoadingPresets(false);
        }
      }
    };

    const loadAmpEquipment = async () => {
      setIsLoadingAmpOptions(true);
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('id, name, category')
          .eq('department', 'sound')
          .in('category', ['pa_amp', 'amplificacion']);

        if (error) throw error;
        if (!isMounted) return;

        const options = (data || []) as Array<{ id: string; name: string; category: string | null }>;
        setAmpOptions(options);

        const findByName = (needle: string) =>
          options.find((eq) => eq.name?.toLowerCase().includes(needle.toLowerCase()));

        setLaAmpEquipmentId((current) => current || findByName('la12x')?.id || options[0]?.id || null);
        setPlmAmpEquipmentId(
          (current) =>
            current ||
            findByName('plm')?.id ||
            findByName('20000')?.id ||
            options.find((eq) => eq.name?.toLowerCase().includes('tf'))?.id ||
            options[0]?.id ||
            null
        );
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load amplifier equipment options', error);
        toast({
          title: "Error",
          description: "No se pudieron cargar las opciones de amplificación (Flex).",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoadingAmpOptions(false);
        }
      }
    };

    const loadSpeakerEquipment = async () => {
      try {
        const { data, error } = await supabase
          .from('equipment')
          .select('id, name')
          .eq('department', 'sound');

        if (error) throw error;
        if (!isMounted) return;

        // Create mapping from speaker name (trimmed) to equipment ID
        const map = new Map<string, string>();
        soundComponentDatabase.forEach((speaker) => {
          const speakerName = speaker.name.trim();
          // Try exact match first, then fallback to includes
          const matchingEquipment = data?.find((eq) =>
            eq.name?.toLowerCase() === speakerName.toLowerCase()
          ) || data?.find((eq) =>
            eq.name?.toLowerCase().includes(speakerName.toLowerCase())
          );
          if (matchingEquipment) {
            map.set(speakerName, matchingEquipment.id);
          }
        });
        setSpeakerEquipmentMap(map);
      } catch (error) {
        if (!isMounted) return;
        console.error('Failed to load speaker equipment mapping', error);
      }
    };

    loadPresets();
    loadAmpEquipment();
    loadSpeakerEquipment();

    return () => {
      isMounted = false;
    };
  }, [toast]);

  const getAvailableSpeakers = (section: string) => {
    const allowedSpeakers = sectionSpeakers[section as keyof typeof sectionSpeakers] || [];
    return soundComponentDatabase.filter(speaker => 
      allowedSpeakers.includes(speaker.name.trim())
    );
  };

  const handleMirroredChange = (section: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        mirrored: checked
      }
    }));
  };

  const handleAddSpeaker = (section: string) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        speakers: [
          ...prev[section].speakers,
          { speakerId: "", quantity: 0, maxLinked: 0 }
        ]
      }
    }));
  };

  const handleRemoveSpeaker = (section: string, index: number) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        speakers: prev[section].speakers.filter((_, i) => i !== index)
      }
    }));
  };

  const handleConfigChange = (
    section: string,
    index: number,
    field: keyof SpeakerConfig,
    value: string | number
  ) => {
    const newValue = field === 'speakerId' ? value : Number(value);
    
    if (field === 'speakerId' && typeof value === 'string') {
      const speaker = soundComponentDatabase.find(s => s.id.toString() === value);
      if (speaker) {
        const speakerConfig = speakerAmplifierConfig[speaker.name.trim()];
        const availableSpeakers = getAvailableSpeakers(section);
        if (!availableSpeakers.find(s => s.id.toString() === value)) {
          toast({
            title: "Invalid speaker selection",
            description: `This speaker is not available for the ${section} section`,
            variant: "destructive"
          });
          return;
        }
        setConfig(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            speakers: prev[section].speakers.map((speaker, i) => 
              i === index ? {
                ...speaker,
                speakerId: value,
                maxLinked: speakerConfig ? speakerConfig.maxLink : 0
              } : speaker
            )
          }
        }));
        return;
      }
    }

    if (field === 'maxLinked') {
      const speaker = soundComponentDatabase.find(
        s => s.id.toString() === config[section].speakers[index].speakerId
      );
      if (speaker) {
        const speakerConfig = speakerAmplifierConfig[speaker.name.trim()];
        if (speakerConfig && Number(value) > speakerConfig.maxLink) {
          toast({
            title: "Max linked limit exceeded",
            description: `Maximum linked quantity for ${speaker.name.trim()} is ${speakerConfig.maxLink}`,
            variant: "destructive"
          });
          return;
        }
      }
    }

    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        speakers: prev[section].speakers.map((speaker, i) =>
          i === index ? { ...speaker, [field]: newValue } : speaker
        )
      }
    }));
  };

  const calculateAmplifiersForSpeaker = (
    speakerId: string,
    quantity: number,
    maxLinked: number,
    mirrored: boolean = false
  ): { amps: number; details: string } => {
    if (!speakerId || quantity === 0) {
      return { amps: 0, details: "No speakers configured" };
    }

    const speaker = soundComponentDatabase.find(s => s.id.toString() === speakerId);
    if (!speaker) {
      return { amps: 0, details: "Invalid speaker selection" };
    }

    const speakerName = speaker.name.trim();
    const config = speakerAmplifierConfig[speakerName];
    
    if (!config) {
      return { amps: 0, details: "Speaker configuration not found" };
    }

    const actualQuantity = mirrored ? quantity * 2 : quantity;
    const actualMaxLinked = Math.min(maxLinked || config.maxLink, config.maxLink);
    
    const groupCount = Math.ceil(actualQuantity / actualMaxLinked);
    const channelsPerGroup = config.channelsRequired;
    const groupsPerAmp = Math.floor(4 / channelsPerGroup);
    const totalAmps = Math.ceil(groupCount / groupsPerAmp);

    const mirrorText = mirrored ? ` × 2 (mirrored clusters)` : '';
    const ampType = isTFSpeaker(speakerName) ? 'PLM20000D' : 'LA12X';
    const channelsText = config.channelsRequired === 1 
      ? '1 channel' 
      : `${config.channelsRequired} channels`;

    return {
      amps: totalAmps,
      details: `${quantity} ${speakerName} speakers${mirrorText} (${channelsText} each, ${actualMaxLinked} linked) requiring ${totalAmps} ${ampType} amplifier${totalAmps !== 1 ? 's' : ''}`
    };
  };

  const calculateAmplifiers = () => {
    const results: AmplifierResults = {
      totalAmplifiersNeeded: 0,
      completeRaks: 0,
      looseAmplifiers: 0,
      plmRacks: 0,
      loosePLMAmps: 0,
      laAmpsTotal: 0,
      plmAmpsTotal: 0,
      perSection: {}
    };

    let totalLAAmps = 0;
    let totalPLMAmps = 0;

    Object.entries(config).forEach(([section, { speakers, mirrored }]) => {
      const sectionResults = {
        amps: 0,
        details: [] as string[],
        totalAmps: 0,
        mirrored: mirrored,
        laAmps: 0,
        plmAmps: 0
      };

      speakers.forEach(speaker => {
        const speakerResults = calculateAmplifiersForSpeaker(
          speaker.speakerId,
          speaker.quantity,
          speaker.maxLinked,
          mirrored
        );
        
        if (speakerResults.amps > 0) {
          sectionResults.amps += speakerResults.amps;
          sectionResults.details.push(speakerResults.details);
          
          const speakerObj = soundComponentDatabase.find(s => s.id.toString() === speaker.speakerId);
          if (speakerObj) {
            if (isTFSpeaker(speakerObj.name)) {
              sectionResults.plmAmps += speakerResults.amps;
              totalPLMAmps += speakerResults.amps;
            } else {
              sectionResults.laAmps += speakerResults.amps;
              totalLAAmps += speakerResults.amps;
            }
          }
        }
      });

      sectionResults.totalAmps = sectionResults.amps;
      results.perSection[section] = sectionResults;
      results.totalAmplifiersNeeded += sectionResults.totalAmps;
    });

    results.completeRaks = Math.floor(totalLAAmps / 3);
    results.looseAmplifiers = totalLAAmps % 3;
    
    results.plmRacks = Math.floor(totalPLMAmps / 3);
    results.loosePLMAmps = totalPLMAmps % 3;
    results.laAmpsTotal = totalLAAmps;
    results.plmAmpsTotal = totalPLMAmps;

    setResults(results);
  };

  const generatePDF = async () => {
    if (!results) {
      toast({
        title: "No calculations",
        description: "Please calculate amplifier requirements first.",
        variant: "destructive"
      });
      return;
    }

    try {
      const pdfBlob = await generateAmplifierPdf(config, results, soundComponentDatabase);
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `amplifier-requirements-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({
        title: "PDF Generated",
        description: "The PDF has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive"
      });
    }
  };

  const cleanupNewlyCreatedPreset = async (presetId: string) => {
    await supabase.from('presets').delete().eq('id', presetId);
    setPresetOptions(prev => prev.filter(p => p.id !== presetId));
    setSelectedPresetId('');
    setCreateNewPreset(false);
    setNewPresetName('');
  };

  const saveResultsToPreset = async () => {
    if (!results) {
      toast({
        title: "Sin cálculos",
        description: "Calcula los amplificadores antes de guardarlos en un preset.",
        variant: "destructive",
      });
      return;
    }

    // Handle creating new preset
    if (createNewPreset) {
      if (!newPresetName.trim()) {
        toast({
          title: "Nombre requerido",
          description: "Ingresa un nombre para el nuevo preset.",
          variant: "destructive",
        });
        return;
      }
    } else if (!selectedPresetId) {
      toast({
        title: "Preset requerido",
        description: "Selecciona un preset de sonido para guardar los amplificadores.",
        variant: "destructive",
      });
      return;
    }

    // Validation for LA equipment
    if (results.completeRaks > 0 && !laRakEquipmentId) {
      toast({
        title: "Falta seleccionar LA-RAK",
        description: "Elige el equipo de LA-RAK para guardar los racks completos.",
        variant: "destructive",
      });
      return;
    }

    if (results.looseAmplifiers > 0 && !laAmpEquipmentId) {
      toast({
        title: "Falta seleccionar LA12X",
        description: "Elige el equipo de LA12X para guardar los amplificadores sueltos.",
        variant: "destructive",
      });
      return;
    }

    // Validation for PLM equipment
    if (results.plmRacks > 0 && !plmRakEquipmentId) {
      toast({
        title: "Falta seleccionar PLM-RAK",
        description: "Elige el equipo de PLM-RAK para guardar los racks completos.",
        variant: "destructive",
      });
      return;
    }

    if (results.loosePLMAmps > 0 && !plmAmpEquipmentId) {
      toast({
        title: "Falta seleccionar PLM20000D",
        description: "Elige el equipo de PLM20000D para guardar los amplificadores sueltos.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingPreset(true);
    try {
      let targetPresetId = selectedPresetId;
      let createdNewPresetId: string | null = null;

      // Create new preset if in create mode
      if (createNewPreset) {
        const { data: session, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session?.session?.user?.id) {
          throw new Error('Usuario no autenticado');
        }

        const { data: newPreset, error: createError } = await supabase
          .from('presets')
          .insert({
            name: newPresetName.trim(),
            created_by: session.session.user.id,
            user_id: session.session.user.id,
            department: 'sound',
            is_template: false,
            job_id: jobId ?? null,
            tour_id: tourId ?? null,
          })
          .select()
          .single();

        if (createError) throw createError;
        if (!newPreset) throw new Error('No se pudo crear el preset');

        targetPresetId = newPreset.id;
        createdNewPresetId = newPreset.id;
        setSelectedPresetId(targetPresetId);
        setCreateNewPreset(false);
        setNewPresetName('');

        // Refresh preset list
        const { data: updatedPresets } = await supabase
          .from('presets')
          .select('id, name')
          .eq('department', 'sound')
          .order('name');
        if (updatedPresets) {
          setPresetOptions(updatedPresets);
        }
      }

      const { data: previousItems, error: fetchError } = await supabase
        .from('preset_items')
        .select('preset_id, equipment_id, quantity, subsystem, source, notes')
        .eq('preset_id', targetPresetId)
        .eq('source', 'amp_calculator');

      if (fetchError) {
        // Clean up newly created preset if fetch fails
        if (createdNewPresetId) {
          await cleanupNewlyCreatedPreset(createdNewPresetId);
        }
        throw fetchError;
      }

      const { error: deleteError } = await supabase
        .from('preset_items')
        .delete()
        .eq('preset_id', targetPresetId)
        .eq('source', 'amp_calculator');

      if (deleteError) {
        // Clean up newly created preset if delete fails
        if (createdNewPresetId) {
          await cleanupNewlyCreatedPreset(createdNewPresetId);
        }
        throw deleteError;
      }

      // Build items to insert using targetPresetId
      const itemsToInsert: Array<{
        preset_id: string;
        equipment_id: string;
        quantity: number;
        subsystem: 'mains' | 'outs' | 'subs' | 'fronts' | 'delays' | 'other' | 'amplification';
        source: 'amp_calculator';
      }> = [];

      // Add speaker items from config
      Object.entries(config).forEach(([section, { speakers, mirrored }]) => {
        speakers.forEach((speaker) => {
          if (speaker.quantity > 0 && speaker.speakerId) {
            const speakerData = soundComponentDatabase.find(s => s.id.toString() === speaker.speakerId);
            if (speakerData) {
              const speakerName = speakerData.name.trim();
              const equipmentId = speakerEquipmentMap.get(speakerName);
              if (equipmentId) {
                // Calculate final quantity (accounting for mirrored)
                const finalQuantity = mirrored ? speaker.quantity * 2 : speaker.quantity;
                itemsToInsert.push({
                  preset_id: targetPresetId,
                  equipment_id: equipmentId,
                  quantity: finalQuantity,
                  subsystem: section as 'mains' | 'outs' | 'subs' | 'fronts' | 'delays' | 'other',
                  source: 'amp_calculator',
                });
              }
            }
          }
        });
      });

      // Add LA-RAK (complete racks)
      if (results.completeRaks > 0 && laRakEquipmentId) {
        itemsToInsert.push({
          preset_id: targetPresetId,
          equipment_id: laRakEquipmentId,
          quantity: results.completeRaks,
          subsystem: 'amplification',
          source: 'amp_calculator',
        });
      }

      // Add loose LA12X amplifiers
      if (results.looseAmplifiers > 0 && laAmpEquipmentId) {
        itemsToInsert.push({
          preset_id: targetPresetId,
          equipment_id: laAmpEquipmentId,
          quantity: results.looseAmplifiers,
          subsystem: 'amplification',
          source: 'amp_calculator',
        });
      }

      // Add PLM-RAK (complete racks)
      if (results.plmRacks > 0 && plmRakEquipmentId) {
        itemsToInsert.push({
          preset_id: targetPresetId,
          equipment_id: plmRakEquipmentId,
          quantity: results.plmRacks,
          subsystem: 'amplification',
          source: 'amp_calculator',
        });
      }

      // Add loose PLM20000D amplifiers
      if (results.loosePLMAmps > 0 && plmAmpEquipmentId) {
        itemsToInsert.push({
          preset_id: targetPresetId,
          equipment_id: plmAmpEquipmentId,
          quantity: results.loosePLMAmps,
          subsystem: 'amplification',
          source: 'amp_calculator',
        });
      }

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('preset_items').insert(itemsToInsert);
        if (insertError) {
          let errorMessage = 'No se pudieron guardar los items en el preset.';

          // Attempt to restore previous items to avoid losing data
          if (previousItems && previousItems.length > 0) {
            const { error: restoreError } = await supabase.from('preset_items').insert(
              previousItems.map((item) => ({
                preset_id: item.preset_id,
                equipment_id: item.equipment_id,
                quantity: item.quantity,
                subsystem: item.subsystem,
                source: item.source,
                notes: item.notes ?? null,
              }))
            );
            if (restoreError) {
              console.error('Failed to restore previous amp calculator items', restoreError);
              // Show critical warning to user
              toast({
                title: "Advertencia crítica",
                description: "Error al guardar items. Falló la restauración de datos anteriores - se pueden haber perdido datos previos.",
                variant: "destructive",
              });
              errorMessage = 'Error al guardar items. Además, falló la restauración de datos anteriores del calculador.';
            }
          }

          // Clean up newly created preset if insertion fails
          if (createdNewPresetId) {
            await cleanupNewlyCreatedPreset(createdNewPresetId);
            errorMessage += ' El preset creado fue eliminado.';
          }

          throw new Error(errorMessage);
        }
      }

      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some((key) => key === 'presets' || key === 'job-presets' || key === 'tour-presets'),
      });

      const savedUnits = itemsToInsert.reduce((sum, item) => sum + item.quantity, 0);
      const speakerCount = itemsToInsert.filter(item => item.subsystem !== 'amplification').length;
      const ampCount = itemsToInsert.filter(item => item.subsystem === 'amplification').length;
      toast({
        title: "Preset actualizado",
        description:
          itemsToInsert.length > 0
            ? `Se guardaron ${speakerCount} altavoces y ${ampCount} amplificadores (${savedUnits} unidades totales).`
            : "Se eliminaron los equipos anteriores calculados.",
      });
    } catch (error) {
      console.error('Failed to save amplifier results to preset', error);
      toast({
        title: "Error al guardar",
        description: error instanceof Error ? error.message : "No se pudieron guardar los amplificadores en el preset.",
        variant: "destructive",
      });
    } finally {
      setIsSavingPreset(false);
    }
  };

  const totalCalculatedAmps = (results?.laAmpsTotal ?? 0) + (results?.plmAmpsTotal ?? 0);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Amplifier Calculator</CardTitle>
      </CardHeader>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-6">
          <Tabs defaultValue="mains" className="space-y-4">
            <TabsList className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-6 w-full gap-1">
              <TabsTrigger value="mains" className="text-xs sm:text-sm px-2">Mains</TabsTrigger>
              <TabsTrigger value="outs" className="text-xs sm:text-sm px-2">Outs</TabsTrigger>
              <TabsTrigger value="subs" className="text-xs sm:text-sm px-2">Subs</TabsTrigger>
              <TabsTrigger value="fronts" className="text-xs sm:text-sm px-2">Fronts</TabsTrigger>
              <TabsTrigger value="delays" className="text-xs sm:text-sm px-2">Delays</TabsTrigger>
              <TabsTrigger value="other" className="text-xs sm:text-sm px-2">Other</TabsTrigger>
            </TabsList>

            <TabsContent value="mains">
              <SpeakerSectionEditor
                section="mains"
                sectionConfig={config.mains}
                getAvailableSpeakers={getAvailableSpeakers}
                onMirroredChange={handleMirroredChange}
                onAddSpeaker={handleAddSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                onConfigChange={handleConfigChange}
              />
            </TabsContent>
            <TabsContent value="outs">
              <SpeakerSectionEditor
                section="outs"
                sectionConfig={config.outs}
                getAvailableSpeakers={getAvailableSpeakers}
                onMirroredChange={handleMirroredChange}
                onAddSpeaker={handleAddSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                onConfigChange={handleConfigChange}
              />
            </TabsContent>
            <TabsContent value="subs">
              <SpeakerSectionEditor
                section="subs"
                sectionConfig={config.subs}
                getAvailableSpeakers={getAvailableSpeakers}
                onMirroredChange={handleMirroredChange}
                onAddSpeaker={handleAddSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                onConfigChange={handleConfigChange}
              />
            </TabsContent>
            <TabsContent value="fronts">
              <SpeakerSectionEditor
                section="fronts"
                sectionConfig={config.fronts}
                getAvailableSpeakers={getAvailableSpeakers}
                onMirroredChange={handleMirroredChange}
                onAddSpeaker={handleAddSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                onConfigChange={handleConfigChange}
              />
            </TabsContent>
            <TabsContent value="delays">
              <SpeakerSectionEditor
                section="delays"
                sectionConfig={config.delays}
                getAvailableSpeakers={getAvailableSpeakers}
                onMirroredChange={handleMirroredChange}
                onAddSpeaker={handleAddSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                onConfigChange={handleConfigChange}
              />
            </TabsContent>
            <TabsContent value="other">
              <SpeakerSectionEditor
                section="other"
                sectionConfig={config.other}
                getAvailableSpeakers={getAvailableSpeakers}
                onMirroredChange={handleMirroredChange}
                onAddSpeaker={handleAddSpeaker}
                onRemoveSpeaker={handleRemoveSpeaker}
                onConfigChange={handleConfigChange}
              />
            </TabsContent>
          </Tabs>

          <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-4 mt-6">
            <Button onClick={calculateAmplifiers} variant="secondary" className="w-full sm:w-auto">
              Calculate Amplifiers
            </Button>
            <Button onClick={generatePDF} className="gap-2 w-full sm:w-auto">
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>

          {results && <AmplifierResultsSummary results={results} />}

          {results && (
            <SaveResultsToPresetPanel
              results={results}
              totalCalculatedAmps={totalCalculatedAmps}
              presetOptions={presetOptions}
              ampOptions={ampOptions}
              createNewPreset={createNewPreset}
              setCreateNewPreset={setCreateNewPreset}
              newPresetName={newPresetName}
              setNewPresetName={setNewPresetName}
              selectedPresetId={selectedPresetId}
              setSelectedPresetId={setSelectedPresetId}
              laRakEquipmentId={laRakEquipmentId}
              setLaRakEquipmentId={setLaRakEquipmentId}
              laAmpEquipmentId={laAmpEquipmentId}
              setLaAmpEquipmentId={setLaAmpEquipmentId}
              plmRakEquipmentId={plmRakEquipmentId}
              setPlmRakEquipmentId={setPlmRakEquipmentId}
              plmAmpEquipmentId={plmAmpEquipmentId}
              setPlmAmpEquipmentId={setPlmAmpEquipmentId}
              isLoadingPresets={isLoadingPresets}
              isLoadingAmpOptions={isLoadingAmpOptions}
              isSavingPreset={isSavingPreset}
              onSave={saveResultsToPreset}
            />
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
