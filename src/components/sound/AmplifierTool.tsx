
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const soundComponentDatabase = [
  { id: 1, name: ' K1 ', weight: 106 },
  { id: 2, name: ' K2 ', weight: 56 },
  { id: 3, name: ' K3 ', weight: 43 },
  { id: 4, name: ' KARA II ', weight: 25 },
  { id: 5, name: ' KIVA ', weight: 14 },
  { id: 6, name: ' KS28 ', weight: 79 },
  { id: 7, name: ' K1-SB ', weight: 83 }
];

const speakerAmplifierConfig: Record<string, { maxLink: number; maxPerAmp: number; channelsRequired: number }> = {
  'K1': { maxLink: 3, maxPerAmp: 2, channelsRequired: 4 },
  'K2': { maxLink: 3, maxPerAmp: 3, channelsRequired: 4 },
  'K3': { maxLink: 4, maxPerAmp: 6, channelsRequired: 2 },
  'KARA II': { maxLink: 4, maxPerAmp: 6, channelsRequired: 2 },
  'KIVA': { maxLink: 8, maxPerAmp: 12, channelsRequired: 1 },
  'KS28': { maxLink: 4, maxPerAmp: 4, channelsRequired: 1 },
  'SB28': { maxLink: 4, maxPerAmp: 4, channelsRequired: 1 },
  'KS21': { maxLink: 4, maxPerAmp: 8, channelsRequired: 0.5 },
  'X15': { maxLink: 2, maxPerAmp: 6, channelsRequired: 2 },
  '115HiQ': { maxLink: 2, maxPerAmp: 6, channelsRequired: 2 }
};

interface SpeakerConfig {
  speakerId: string;
  quantity: number;
  maxLinked: number;
}

interface SpeakerSection {
  mains: SpeakerConfig;
  outs: SpeakerConfig;
  subs: SpeakerConfig;
  fronts: SpeakerConfig;
  delays: SpeakerConfig;
  other: SpeakerConfig;
}

interface AmplifierResults {
  totalAmplifiersNeeded: number;
  completeRaks: number;
  looseAmplifiers: number;
  perSection: {
    [key: string]: {
      amps: number;
      details: string;
    };
  };
}

export const AmplifierTool = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<SpeakerSection>({
    mains: { speakerId: "", quantity: 0, maxLinked: 0 },
    outs: { speakerId: "", quantity: 0, maxLinked: 0 },
    subs: { speakerId: "", quantity: 0, maxLinked: 0 },
    fronts: { speakerId: "", quantity: 0, maxLinked: 0 },
    delays: { speakerId: "", quantity: 0, maxLinked: 0 },
    other: { speakerId: "", quantity: 0, maxLinked: 0 }
  });

  const [results, setResults] = useState<AmplifierResults | null>(null);

  const handleConfigChange = (
    section: keyof SpeakerSection,
    field: keyof SpeakerConfig,
    value: string | number
  ) => {
    const newValue = field === 'speakerId' ? value : Number(value);
    
    // If changing speaker type, reset maxLinked to the default max for that speaker
    if (field === 'speakerId' && typeof value === 'string') {
      const speaker = soundComponentDatabase.find(s => s.id.toString() === value);
      if (speaker) {
        const speakerConfig = speakerAmplifierConfig[speaker.name.trim()];
        setConfig(prev => ({
          ...prev,
          [section]: {
            ...prev[section],
            speakerId: value,
            maxLinked: speakerConfig ? speakerConfig.maxLink : 0
          }
        }));
        return;
      }
    }

    // For maxLinked, ensure it doesn't exceed the speaker's maximum
    if (field === 'maxLinked') {
      const speaker = soundComponentDatabase.find(
        s => s.id.toString() === config[section].speakerId
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
        [field]: newValue
      }
    }));
  };

  const calculateAmplifiersForSection = (
    speakerId: string,
    quantity: number,
    maxLinked: number
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

    const actualMaxLinked = Math.min(maxLinked || config.maxLink, config.maxLink);
    const groups = Math.ceil(quantity / actualMaxLinked);
    const speakersPerGroup = Math.min(quantity, actualMaxLinked);
    const ampsPerGroup = Math.ceil(speakersPerGroup / config.maxPerAmp);
    const totalAmps = groups * ampsPerGroup;

    return {
      amps: totalAmps,
      details: `${quantity} ${speakerName} speakers in ${groups} group${groups !== 1 ? 's' : ''} ` +
               `(max ${actualMaxLinked} linked) requiring ${totalAmps} amplifier${totalAmps !== 1 ? 's' : ''}`
    };
  };

  const calculateAmplifiers = () => {
    const results: AmplifierResults = {
      totalAmplifiersNeeded: 0,
      completeRaks: 0,
      looseAmplifiers: 0,
      perSection: {}
    };

    // Calculate for each section
    Object.entries(config).forEach(([section, sectionConfig]) => {
      const sectionResults = calculateAmplifiersForSection(
        sectionConfig.speakerId,
        sectionConfig.quantity,
        sectionConfig.maxLinked
      );
      
      results.perSection[section] = sectionResults;
      results.totalAmplifiersNeeded += sectionResults.amps;
    });

    // Calculate complete racks and loose amplifiers
    results.completeRaks = Math.floor(results.totalAmplifiersNeeded / 3);
    results.looseAmplifiers = results.totalAmplifiersNeeded % 3;

    setResults(results);
  };

  const generatePDF = () => {
    // Will be implemented similar to other tools' PDF generation
    console.log("Generating PDF for config:", config);
    toast({
      title: "PDF Generation",
      description: "PDF generation will be implemented in the next phase",
    });
  };

  const renderSpeakerSection = (section: keyof SpeakerSection, title: string) => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${section}-speaker`}>Speaker Type</Label>
          <Select
            value={config[section].speakerId}
            onValueChange={(value) => handleConfigChange(section, "speakerId", value)}
          >
            <SelectTrigger id={`${section}-speaker`}>
              <SelectValue placeholder="Select speaker" />
            </SelectTrigger>
            <SelectContent>
              {soundComponentDatabase.map((speaker) => (
                <SelectItem key={speaker.id} value={speaker.id.toString()}>
                  {speaker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${section}-quantity`}>Quantity</Label>
          <Input
            id={`${section}-quantity`}
            type="number"
            min="0"
            value={config[section].quantity}
            onChange={(e) => handleConfigChange(section, "quantity", e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${section}-maxlinked`}>Max Linked</Label>
          <Input
            id={`${section}-maxlinked`}
            type="number"
            min="0"
            value={config[section].maxLinked}
            onChange={(e) => handleConfigChange(section, "maxLinked", e.target.value)}
          />
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Amplifier Calculator</CardTitle>
      </CardHeader>
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
            
            <div className="space-y-2">
              {Object.entries(results.perSection).map(([section, data]) => (
                data.amps > 0 && (
                  <div key={section} className="text-sm">
                    <span className="font-medium capitalize">{section}</span>: {data.details}
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
    </Card>
  );
};

