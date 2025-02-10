
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";

// Using the same database as PesosTool
const soundComponentDatabase = [
  { id: 1, name: ' K1 ', weight: 106 },
  { id: 2, name: ' K2 ', weight: 56 },
  { id: 3, name: ' K3 ', weight: 43 },
  { id: 4, name: ' KARA II ', weight: 25 },
  { id: 5, name: ' KIVA ', weight: 14 },
  { id: 6, name: ' KS28 ', weight: 79 },
  { id: 7, name: ' K1-SB ', weight: 83 }
];

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

export const AmplifierTool = () => {
  const [config, setConfig] = useState<SpeakerSection>({
    mains: { speakerId: "", quantity: 0, maxLinked: 0 },
    outs: { speakerId: "", quantity: 0, maxLinked: 0 },
    subs: { speakerId: "", quantity: 0, maxLinked: 0 },
    fronts: { speakerId: "", quantity: 0, maxLinked: 0 },
    delays: { speakerId: "", quantity: 0, maxLinked: 0 },
    other: { speakerId: "", quantity: 0, maxLinked: 0 }
  });

  const handleConfigChange = (
    section: keyof SpeakerSection,
    field: keyof SpeakerConfig,
    value: string | number
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const calculateAmplifiers = () => {
    // This will be implemented with your calculation parameters
    console.log("Calculating amplifiers for config:", config);
  };

  const generatePDF = () => {
    // This will be implemented similar to other tools' PDF generation
    console.log("Generating PDF for config:", config);
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
            onChange={(e) => handleConfigChange(section, "quantity", parseInt(e.target.value) || 0)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${section}-maxlinked`}>Max Linked</Label>
          <Input
            id={`${section}-maxlinked`}
            type="number"
            min="0"
            value={config[section].maxLinked}
            onChange={(e) => handleConfigChange(section, "maxLinked", parseInt(e.target.value) || 0)}
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

        <div className="mt-6 p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-4">Required Amplifiers</h3>
          <p className="text-muted-foreground">
            Results will appear here after calculation
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
