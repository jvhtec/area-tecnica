import React, { useState, useEffect } from "react";
import { SimplifiedJobColorPicker } from "../jobs/SimplifiedJobColorPicker";
import { Palette } from "lucide-react";

interface TourColorSectionProps {
  color: string;
  tourName: string;
  onColorChange: (color: string) => Promise<void>;
  onNameChange: (name: string) => Promise<void>;
}

export const TourColorSection: React.FC<TourColorSectionProps> = ({
  color,
  tourName,
  onColorChange,
  onNameChange,
}) => {
  // Use local state so that the input is editable immediately.
  const [localName, setLocalName] = useState(tourName);

  // If the parent updates the tourName prop, update our local state.
  useEffect(() => {
    setLocalName(tourName);
  }, [tourName]);

  // When the input loses focus, call onNameChange to persist the change.
  const handleBlur = async () => {
    if (localName !== tourName) {
      try {
        await onNameChange(localName);
      } catch (error) {
        console.error("Error updating tour name:", error);
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
          onBlur={handleBlur}
          className="w-full border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
};