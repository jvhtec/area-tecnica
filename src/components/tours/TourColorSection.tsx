import React, { useState, useEffect } from "react";
import { SimplifiedJobColorPicker } from "../jobs/SimplifiedJobColorPicker";
import { Palette, FileText, Building2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoicingCompany } from "@/types/job";

interface TourColorSectionProps {
  color: string;
  tourName: string;
  tourDescription?: string;
  invoicingCompany?: InvoicingCompany | null;
  onColorChange: (color: string) => Promise<void>;
  onNameChange: (name: string) => Promise<void>;
  onDescriptionChange: (description: string) => Promise<void>;
  onInvoicingCompanyChange: (company: InvoicingCompany | null) => Promise<void>;
}

export const TourColorSection: React.FC<TourColorSectionProps> = ({
  color,
  tourName,
  tourDescription = "",
  invoicingCompany = null,
  onColorChange,
  onNameChange,
  onDescriptionChange,
  onInvoicingCompanyChange,
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

      {/* Invoicing Company Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          <span className="font-medium">Invoicing Company</span>
        </div>
        <Select
          value={invoicingCompany || "none"}
          onValueChange={(value) => onInvoicingCompanyChange(value === "none" ? null : value as InvoicingCompany)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select invoicing company (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            <SelectItem value="Production Sector">Production Sector</SelectItem>
            <SelectItem value="Sharecable">Sharecable</SelectItem>
            <SelectItem value="MFO">MFO</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          All tour date jobs will inherit this invoicing company
        </p>
      </div>
    </div>
  );
};