import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Loader2, Plus, Repeat, Save, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateAmplifierPdf } from "@/utils/amplifierCalculationPdf";
import { supabase } from "@/lib/supabase";
import { useQueryClient } from "@tanstack/react-query";

const soundComponentDatabase = [
  { id: 1, name: ' K1 ', weight: 56 },
  { id: 2, name: ' K2 ', weight: 43 },
  { id: 3, name: ' K3 ', weight: 35 },
  { id: 4, name: ' KARA II ', weight: 26 },
  { id: 5, name: ' KIVA ', weight: 13 },
  { id: 6, name: ' KS28 ', weight: 79 },
  { id: 7, name: ' SB28 ', weight: 93 },
  { id: 8, name: ' K1-SB ', weight: 83 },
  { id: 9, name: ' KS21 ', weight: 49 },
  { id: 10, name: ' X15 ', weight: 21 },
  { id: 11, name: ' 115HiQ ', weight: 35 },
  { id: 12, name: ' TFS900H ', weight: 45 },
  { id: 13, name: ' TFS600A ', weight: 35 },
  { id: 14, name: ' TFS550H ', weight: 28 },
  { id: 15, name: ' TFS900B ', weight: 65 },
  { id: 16, name: ' TFS550L ', weight: 42 }
];

const sectionSpeakers = {
  mains: ['K1', 'K2', 'K3', 'KARA II', 'TFS900H', 'TFS600A', 'TFS550H'],
  outs: ['K1', 'K2', 'K3', 'KARA II', 'TFS900H', 'TFS600A', 'TFS550H'],
  subs: ['KS28', 'SB28', 'K1-SB', 'KS21', 'TFS900B', 'TFS550L'],
  fronts: ['KARA II', 'KIVA'],
  delays: ['K1', 'K2', 'K3', 'KARA II', 'TFS900H', 'TFS600A', 'TFS550H'],
  other: ['KIVA', 'X15', '115HiQ']
};

const speakerAmplifierConfig: Record<string, { maxLink: number; maxPerAmp: number; channelsRequired: number }> = {
  'K1': { maxLink: 2, maxPerAmp: 2, channelsRequired: 4 },
  'K2': { maxLink: 3, maxPerAmp: 3, channelsRequired: 4 },
  'K3': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  'KARA II': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  'KIVA': { maxLink: 4, maxPerAmp: 12, channelsRequired: 1 },
  'KS28': { maxLink: 1, maxPerAmp: 4, channelsRequired: 1 },
  'SB28': { maxLink: 1, maxPerAmp: 4, channelsRequired: 1 },
  'K1-SB': { maxLink: 1, maxPerAmp: 4, channelsRequired: 1 },
  'KS21': { maxLink: 2, maxPerAmp: 8, channelsRequired: 0.5 },
  'X15': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  '115HiQ': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  'TFS900H': { maxLink: 3, maxPerAmp: 3, channelsRequired: 4 },
  'TFS600A': { maxLink: 3, maxPerAmp: 3, channelsRequired: 3 },
  'TFS550H': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  'TFS900B': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 },
  'TFS550L': { maxLink: 3, maxPerAmp: 12, channelsRequired: 1 }
};

const isTFSpeaker = (speakerName: string): boolean => {
  return speakerName.trim().startsWith('TFS');
};

export interface SpeakerConfig {
  speakerId: string;
  quantity: number;
  maxLinked: number;
}

export interface SpeakerSection {
  speakers: SpeakerConfig[];
  mirrored?: boolean;
}

export interface AmplifierResults {
  totalAmplifiersNeeded: number;
  completeRaks: number;
  looseAmplifiers: number;
  plmRacks: number;
  loosePLMAmps: number;
  laAmpsTotal: number;
  plmAmpsTotal: number;
  perSection: {
    [key: string]: {
      amps: number;
      details: string[];
      totalAmps: number;
      mirrored?: boolean;
      laAmps?: number;
      plmAmps?: number;
    };
  };
}

export const AmplifierTool = () => {
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
  const [laAmpEquipmentId, setLaAmpEquipmentId] = useState<string | null>(null);
  const [plmAmpEquipmentId, setPlmAmpEquipmentId] = useState<string | null>(null);
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);
  const [isLoadingAmpOptions, setIsLoadingAmpOptions] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);

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

    loadPresets();
    loadAmpEquipment();

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

  const saveResultsToPreset = async () => {
    if (!results) {
      toast({
        title: "Sin cálculos",
        description: "Calcula los amplificadores antes de guardarlos en un preset.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPresetId) {
      toast({
        title: "Preset requerido",
        description: "Selecciona un preset de sonido para guardar los amplificadores.",
        variant: "destructive",
      });
      return;
    }

    const laQuantity = results.laAmpsTotal;
    const plmQuantity = results.plmAmpsTotal;

    if (laQuantity > 0 && !laAmpEquipmentId) {
      toast({
        title: "Falta seleccionar LA12X",
        description: "Elige el equipo de LA12X para guardar los resultados.",
        variant: "destructive",
      });
      return;
    }

    if (plmQuantity > 0 && !plmAmpEquipmentId) {
      toast({
        title: "Falta seleccionar PLM20000D",
        description: "Elige el equipo de PLM20000D para guardar los resultados.",
        variant: "destructive",
      });
      return;
    }

    const itemsToInsert: Array<{
      preset_id: string;
      equipment_id: string;
      quantity: number;
      subsystem: 'amplification';
      source: 'amp_calculator';
    }> = [];

    if (laQuantity > 0 && laAmpEquipmentId) {
      itemsToInsert.push({
        preset_id: selectedPresetId,
        equipment_id: laAmpEquipmentId,
        quantity: laQuantity,
        subsystem: 'amplification',
        source: 'amp_calculator',
      });
    }

    if (plmQuantity > 0 && plmAmpEquipmentId) {
      itemsToInsert.push({
        preset_id: selectedPresetId,
        equipment_id: plmAmpEquipmentId,
        quantity: plmQuantity,
        subsystem: 'amplification',
        source: 'amp_calculator',
      });
    }

    setIsSavingPreset(true);
    try {
      const { data: previousItems, error: fetchError } = await supabase
        .from('preset_items')
        .select('preset_id, equipment_id, quantity, subsystem, source, notes')
        .eq('preset_id', selectedPresetId)
        .eq('source', 'amp_calculator');

      if (fetchError) throw fetchError;

      const { error: deleteError } = await supabase
        .from('preset_items')
        .delete()
        .eq('preset_id', selectedPresetId)
        .eq('source', 'amp_calculator');

      if (deleteError) throw deleteError;

      if (itemsToInsert.length > 0) {
        const { error: insertError } = await supabase.from('preset_items').insert(itemsToInsert);
        if (insertError) {
          // Attempt to restore previous items to avoid losing data
          if (previousItems && previousItems.length > 0) {
            await supabase.from('preset_items').insert(
              previousItems.map((item) => ({
                ...item,
                // ensure nullable fields remain defined
                notes: item.notes ?? null,
              }))
            );
          }
          throw insertError;
        }
      }

      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey.some((key) => key === 'presets' || key === 'job-presets' || key === 'tour-presets'),
      });

      const savedUnits = itemsToInsert.reduce((sum, item) => sum + item.quantity, 0);
      toast({
        title: "Preset actualizado",
        description:
          itemsToInsert.length > 0
            ? `Se guardaron ${savedUnits} amplificadores en el preset seleccionado.`
            : "Se eliminaron los amplificadores anteriores calculados.",
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

  const renderSpeakerSection = (section: string, title: string) => (
    <div className="space-y-4">
      {['mains', 'outs', 'delays'].includes(section) && (
        <div className="flex items-center space-x-2 bg-muted/50 rounded-lg p-3 border">
          <Checkbox
            id={`${section}-mirrored`}
            checked={config[section].mirrored}
            onCheckedChange={(checked) => handleMirroredChange(section, checked as boolean)}
          />
          <Label htmlFor={`${section}-mirrored`} className="flex items-center space-x-2 cursor-pointer text-sm font-medium">
            <Repeat className="h-4 w-4" />
            <span>Mirrored Clusters</span>
          </Label>
        </div>
      )}
      
      {config[section].speakers.map((speaker, index) => (
        <div key={index} className="relative border rounded-lg p-4 bg-card">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => handleRemoveSpeaker(section, index)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${section}-${index}-speaker`} className="text-sm font-medium">Speaker Type</Label>
              <Select
                value={speaker.speakerId}
                onValueChange={(value) => handleConfigChange(section, index, "speakerId", value)}
              >
                <SelectTrigger id={`${section}-${index}-speaker`}>
                  <SelectValue placeholder="Select speaker" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableSpeakers(section).map((speaker) => (
                    <SelectItem key={speaker.id} value={speaker.id.toString()}>
                      {speaker.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${section}-${index}-quantity`} className="text-sm font-medium">Quantity</Label>
              <Input
                id={`${section}-${index}-quantity`}
                type="number"
                min="0"
                value={speaker.quantity}
                onChange={(e) => handleConfigChange(section, index, "quantity", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${section}-${index}-maxlinked`} className="text-sm font-medium">Max Linked</Label>
              <Input
                id={`${section}-${index}-maxlinked`}
                type="number"
                min="0"
                value={speaker.maxLinked}
                onChange={(e) => handleConfigChange(section, index, "maxLinked", e.target.value)}
              />
            </div>
          </div>
        </div>
      ))}
      <Button 
        variant="outline" 
        className="w-full"
        onClick={() => handleAddSpeaker(section)}
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Speaker
      </Button>
    </div>
  );

  const totalCalculatedAmps = (results?.laAmpsTotal ?? 0) + (results?.plmAmpsTotal ?? 0);

  return (
    <Card className="w-full">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">Amplifier Calculator</CardTitle>
      </CardHeader>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent className="space-y-6">
          <Tabs defaultValue="mains" className="space-y-4">
            <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 w-full">
              <TabsTrigger value="mains" className="text-xs sm:text-sm">Mains</TabsTrigger>
              <TabsTrigger value="outs" className="text-xs sm:text-sm">Outs</TabsTrigger>
              <TabsTrigger value="subs" className="text-xs sm:text-sm">Subs</TabsTrigger>
              <TabsTrigger value="fronts" className="text-xs sm:text-sm">Fronts</TabsTrigger>
              <TabsTrigger value="delays" className="text-xs sm:text-sm">Delays</TabsTrigger>
              <TabsTrigger value="other" className="text-xs sm:text-sm">Other</TabsTrigger>
            </TabsList>

            <TabsContent value="mains">
              {renderSpeakerSection("mains", "Main Speakers")}
            </TabsContent>
            <TabsContent value="outs">
              {renderSpeakerSection("outs", "Out Speakers")}
            </TabsContent>
            <TabsContent value="subs">
              {renderSpeakerSection("subs", "Subwoofers")}
            </TabsContent>
            <TabsContent value="fronts">
              {renderSpeakerSection("fronts", "Front Fills")}
            </TabsContent>
            <TabsContent value="delays">
              {renderSpeakerSection("delays", "Delay Speakers")}
            </TabsContent>
            <TabsContent value="other">
              {renderSpeakerSection("other", "Other Speakers")}
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

          {results && (
            <div className="mt-6 border rounded-lg overflow-hidden">
              <div className="bg-muted px-4 py-3">
                <h3 className="text-lg font-semibold">Required Amplifiers</h3>
              </div>
              
              <div className="p-4 space-y-4">
                {Object.entries(results.perSection).map(([section, data]) => (
                  data.totalAmps > 0 && (
                    <div key={section} className="space-y-2 pb-4 border-b last:border-b-0 last:pb-0">
                      <div className="font-medium capitalize text-sm text-muted-foreground">
                        {section}{data.mirrored ? ' (Mirrored)' : ''}
                      </div>
                      {data.details.map((detail, index) => (
                        <div key={index} className="text-sm pl-4">
                          {detail}
                        </div>
                      ))}
                      {data.details.length > 1 && (
                        <div className="text-sm pl-4 font-medium">
                          Total amplifiers for {section}: {data.totalAmps}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>

              <div className="bg-muted/50 px-4 py-3 border-t space-y-2">
                <div className="font-semibold text-sm text-muted-foreground">Summary</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {results.completeRaks > 0 && (
                    <div className="flex justify-between">
                      <span>LA-RAKs required:</span>
                      <span className="font-medium">{results.completeRaks}</span>
                    </div>
                  )}
                  {results.looseAmplifiers > 0 && (
                    <div className="flex justify-between">
                      <span>Loose LA12X amplifiers:</span>
                      <span className="font-medium">{results.looseAmplifiers}</span>
                    </div>
                  )}
                  {results.plmRacks > 0 && (
                    <div className="flex justify-between">
                      <span>PLM20000 Racks:</span>
                      <span className="font-medium">{results.plmRacks}</span>
                    </div>
                  )}
                  {results.loosePLMAmps > 0 && (
                    <div className="flex justify-between">
                      <span>Loose PLM20000D amplifiers:</span>
                      <span className="font-medium">{results.loosePLMAmps}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Total amplifiers needed:</span>
                  <span>{results.totalAmplifiersNeeded}</span>
                </div>
              </div>
            </div>
          )}

          {results && (
            <div className="mt-4 border rounded-lg p-4 space-y-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="font-semibold text-sm">Guardar en preset</h4>
                  <p className="text-xs text-muted-foreground">
                    Inserta los amplificadores calculados como items de preset (subsystem amplification).
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {totalCalculatedAmps} amplificadores calculados
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preset de sonido</Label>
                  <Select
                    value={selectedPresetId}
                    onValueChange={setSelectedPresetId}
                    disabled={isLoadingPresets || presetOptions.length === 0 || isSavingPreset}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingPresets ? "Cargando presets..." : "Selecciona un preset"} />
                    </SelectTrigger>
                    <SelectContent>
                      {presetOptions.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Equipo LA12X</Label>
                  <Select
                    value={laAmpEquipmentId || ''}
                    onValueChange={setLaAmpEquipmentId}
                    disabled={isLoadingAmpOptions || ampOptions.length === 0 || isSavingPreset}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={isLoadingAmpOptions ? "Cargando equipos..." : "Selecciona LA12X"} />
                    </SelectTrigger>
                    <SelectContent>
                      {ampOptions.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Cantidad calculada: {results.laAmpsTotal}</p>
                </div>

                <div className="space-y-2">
                  <Label>Equipo PLM20000D</Label>
                  <Select
                    value={plmAmpEquipmentId || ''}
                    onValueChange={setPlmAmpEquipmentId}
                    disabled={isLoadingAmpOptions || ampOptions.length === 0 || isSavingPreset}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={isLoadingAmpOptions ? "Cargando equipos..." : "Selecciona PLM20000D"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {ampOptions.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Cantidad calculada: {results.plmAmpsTotal}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Los items se guardan con subsystem &quot;amplification&quot; y source &quot;amp_calculator&quot;.
                </p>
                <Button
                  onClick={saveResultsToPreset}
                  disabled={
                    isSavingPreset ||
                    !selectedPresetId ||
                    (results.laAmpsTotal > 0 && !laAmpEquipmentId) ||
                    (results.plmAmpsTotal > 0 && !plmAmpEquipmentId)
                  }
                  className="w-full sm:w-auto gap-2"
                >
                  {isSavingPreset ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Guardar en preset
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
