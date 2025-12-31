import React from "react";
import { Plus, Repeat, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SpeakerConfig, SpeakerSection } from "./types";

export const SpeakerSectionEditor: React.FC<{
  section: string;
  sectionConfig: SpeakerSection;
  getAvailableSpeakers: (section: string) => Array<{ id: number; name: string }>;
  onMirroredChange: (section: string, checked: boolean) => void;
  onAddSpeaker: (section: string) => void;
  onRemoveSpeaker: (section: string, index: number) => void;
  onConfigChange: (section: string, index: number, field: keyof SpeakerConfig, value: string | number | boolean) => void;
}> = ({
  section,
  sectionConfig,
  getAvailableSpeakers,
  onMirroredChange,
  onAddSpeaker,
  onRemoveSpeaker,
  onConfigChange,
}) => (
  <div className="space-y-4">
    {["mains", "outs", "delays"].includes(section) && (
      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-3 border">
        <Checkbox
          id={`${section}-mirrored`}
          checked={sectionConfig.mirrored}
          onCheckedChange={(checked) => onMirroredChange(section, checked as boolean)}
        />
        <Label htmlFor={`${section}-mirrored`} className="flex items-center gap-2 cursor-pointer text-sm font-medium flex-1">
          <Repeat className="h-4 w-4 flex-shrink-0" />
          <span className="whitespace-nowrap">Mirrored Clusters</span>
        </Label>
      </div>
    )}

    {sectionConfig.speakers.map((speaker, index) => (
      <div key={index} className="relative border rounded-lg p-4 bg-card">
        <Button variant="ghost" size="icon" className="absolute right-2 top-2" onClick={() => onRemoveSpeaker(section, index)}>
          <X className="h-4 w-4" />
        </Button>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${section}-${index}-speaker`} className="text-sm font-medium">
              Speaker Type
            </Label>
            <Select value={speaker.speakerId} onValueChange={(value) => onConfigChange(section, index, "speakerId", value)}>
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
            <Label htmlFor={`${section}-${index}-quantity`} className="text-sm font-medium">
              Quantity
            </Label>
            <Input
              id={`${section}-${index}-quantity`}
              type="number"
              min="0"
              value={speaker.quantity}
              onChange={(e) => onConfigChange(section, index, "quantity", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${section}-${index}-maxlinked`} className="text-sm font-medium">
              Max Linked
            </Label>
            <Input
              id={`${section}-${index}-maxlinked`}
              type="number"
              min="0"
              value={speaker.maxLinked}
              onChange={(e) => onConfigChange(section, index, "maxLinked", e.target.value)}
            />
          </div>
        </div>
      </div>
    ))}
    <Button variant="outline" className="w-full" onClick={() => onAddSpeaker(section)}>
      <Plus className="h-4 w-4 mr-2" />
      Add Speaker
    </Button>
  </div>
);

