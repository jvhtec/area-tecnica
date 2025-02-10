import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Plus, X, Repeat } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateAmplifierPdf } from "@/utils/amplifierCalculationPdf";

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
  { id: 11, name: ' 115HiQ ', weight: 35 }
];

const sectionSpeakers = {
  mains: ['K1', 'K2', 'K3', 'KARA II'],
  outs: ['K1', 'K2', 'K3', 'KARA II'],
  subs: ['KS28', 'SB28', 'K1-SB', 'KS21'],
  fronts: ['X15', '115HiQ'],
  delays: ['K1', 'K2', 'K3', 'KARA II'],
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
  '115HiQ': { maxLink: 3, maxPerAmp: 6, channelsRequired: 2 }
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
  perSection: {
    [key: string]: {
      amps: number;
      details: string[];
      totalAmps: number;
      mirrored?: boolean;
    };
  };
}

export const AmplifierTool = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<Record<string, SpeakerSection>>({
    mains: { speakers: [], mirrored: false },
    outs: { speakers: [], mirrored: false },
    subs: { speakers: [] },
    fronts: { speakers: [] },
    delays: { speakers: [], mirrored: false },
    other: { speakers: [] }
  });

  const [results, setResults] = useState<AmplifierResults | null>(null);

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
    const groups = Math.ceil(actualQuantity / actualMaxLinked);
    const speakersPerGroup = Math.min(actualQuantity, actualMaxLinked);
    const ampsPerGroup = Math.ceil(speakersPerGroup / config.maxPerAmp);
    const totalAmps = groups * ampsPerGroup;

    const mirrorText = mirrored ? ` × 2 (mirrored clusters)` : '';
    return {
      amps: totalAmps,
      details: `${quantity} ${speakerName} speakers${mirrorText} requiring ${totalAmps} amplifier${totalAmps !== 1 ? 's' : ''}`
    };
  };

  const calculateAmplifiers = () => {
    const results: AmplifierResults = {
      totalAmplifiersNeeded: 0,
      completeRaks: 0,
      looseAmplifiers: 0,
      perSection: {}
    };

    Object.entries(config).forEach(([section, { speakers, mirrored }]) => {
      const sectionResults = {
        amps: 0,
        details: [] as string[],
        totalAmps: 0,
        mirrored: mirrored
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
        }
      });

      sectionResults.totalAmps = sectionResults.amps;
      results.perSection[section] = sectionResults;
      results.totalAmplifiersNeeded += sectionResults.totalAmps;
    });

    results.completeRaks = Math.floor(results.totalAmplifiersNeeded / 3);
    results.looseAmplifiers = results.totalAmplifiersNeeded % 3;

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

  const renderSpeakerSection = (section: string, title: string) => (
    <div className="space-y-4">
      {['mains', 'outs', 'delays'].includes(section) && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`${section}-mirrored`}
            checked={config[section].mirrored}
            onCheckedChange={(checked) => handleMirroredChange(section, checked as boolean)}
          />
          <Label htmlFor={`${section}-mirrored`} className="flex items-center space-x-2 cursor-pointer">
            <Repeat className="h-4 w-4" />
            <span>Mirrored Clusters</span>
          </Label>
        </div>
      )}
      
      {config[section].speakers.map((speaker, index) => (
        <div key={index} className="relative border rounded-lg p-4">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2"
            onClick={() => handleRemoveSpeaker(section, index)}
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`${section}-${index}-speaker`}>Speaker Type</Label>
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
              <Label htmlFor={`${section}-${index}-quantity`}>Quantity</Label>
              <Input
                id={`${section}-${index}-quantity`}
                type="number"
                min="0"
                value={speaker.quantity}
                onChange={(e) => handleConfigChange(section, index, "quantity", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${section}-${index}-maxlinked`}>Max Linked</Label>
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Amplifier Calculator</CardTitle>
      </CardHeader>
      <ScrollArea className="h-[calc(100vh-12rem)]">
        <CardContent>
          <Tabs defaultValue="mains" className="space-y-4">
            <TabsList className="grid grid-cols-3 lg:grid-cols-6">
              <TabsTrigger value="mains">Mains</TabsTrigger>
              <TabsTrigger value="outs">Outs</TabsTrigger>
              <TabsTrigger value="subs">Subs</TabsTrigger>
              <TabsTrigger value="fronts">Fronts</TabsTrigger>
              <TabsTrigger value="delays">Delays</TabsTrigger>
              <TabsTrigger value="other">Other</TabsTrigger>
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

          <div className="flex justify-end gap-4 mt-6">
            <Button onClick={calculateAmplifiers} variant="secondary">
              Calculate Amplifiers
            </Button>
            <Button onClick={generatePDF} className="gap-2">
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
          </div>

          {results && (
            <div className="mt-6 p-4 border rounded-lg space-y-4">
              <h3 className="text-lg font-semibold">Required Amplifiers</h3>
              
              <div className="space-y-4">
                {Object.entries(results.perSection).map(([section, data]) => (
                  data.totalAmps > 0 && (
                    <div key={section} className="space-y-2">
                      <div className="font-medium capitalize">
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

              <div className="pt-4 border-t mt-4">
                <div className="font-medium">Summary:</div>
                <div className="text-sm space-y-1">
                  <div>Total LA-RAKs required: {results.completeRaks}</div>
                  <div>Additional loose amplifiers: {results.looseAmplifiers}</div>
                  <div className="font-medium pt-2">
                    Total amplifiers needed: {results.totalAmplifiersNeeded}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
