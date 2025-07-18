import React, { useState, useEffect } from "react";
import { SimplifiedJobColorPicker } from "../jobs/SimplifiedJobColorPicker";
import { Palette, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface TourColorSectionProps {
  color: string;
  tourName: string;
  tourDescription?: string;
  onColorChange: (color: string) => Promise<void>;
  onNameChange: (name: string) => Promise<void>;
  onDescriptionChange: (description: string) => Promise<void>;
}

export const TourColorSection: React.FC<TourColorSectionProps> = ({
  color,
  tourName,
  tourDescription = "",
  onColorChange,
  onNameChange,
  onDescriptionChange,
}) => {
  // Use local state so that inputs are editable immediately.
  const [localName, setLocalName] = useState(tourName);
  const [localDescription, setLocalDescription] = useState(tourDescription);

  // If the parent updates the props, update our local state.
  useEffect(() => {
    setLocalName(tourName);
  }, [tourName]);

  useEffect(() => {
    setLocalDescription(tourDescription);
  }, [tourDescription]);

  // When inputs lose focus, persist the changes.
  const handleNameBlur = async () => {
    if (localName !== tourName) {
      try {
        await onNameChange(localName);
      } catch (error) {
        console.error("Error updating tour name:", error);
      }
    }
  };

  const handleDescriptionBlur = async () => {
    if (localDescription !== tourDescription) {
      try {
        await onDescriptionChange(localDescription);
      } catch (error) {
        console.error("Error updating tour description:", error);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Tour Color Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4" />
          <span className="font-medium">Tour Color</span>
        </div>
        <SimplifiedJobColorPicker color={color} onChange={onColorChange} />
      </div>

      {/* Tour Name Editing Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">Tour Name</span>
        </div>
        <input
          type="text"
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleNameBlur}
          className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Tour Description Editing Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <span className="font-medium">Tour Description</span>
        </div>
        <Textarea
          value={localDescription}
          onChange={(e) => setLocalDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="Enter tour description..."
          className="w-full min-h-[80px]"
        />
      </div>
    </div>
  );
};