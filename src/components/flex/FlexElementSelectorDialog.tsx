import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FlexElementOption {
  elementId: string;
  label: string;
  department: string | null;
}

interface FlexElementSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mainElementId: string;
  defaultDepartment?: string | null;
  jobId: string;
}

export const FlexElementSelectorDialog: React.FC<
  FlexElementSelectorDialogProps
> = ({ open, onOpenChange, mainElementId, defaultDepartment, jobId }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [elementOptions, setElementOptions] = useState<FlexElementOption[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string>("");

  const loadElementOptions = React.useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all department folders for this job
      const { data, error } = await supabase
        .from("flex_folders")
        .select("element_id, department, folder_type")
        .eq("job_id", jobId)
        .order("department", { ascending: true });

      if (error) {
        console.error("Error loading Flex folder options:", error);
        toast({
          title: "Error",
          description: "Could not load Flex folder options.",
          variant: "destructive",
        });
        return;
      }

      if (!data || data.length === 0) {
        toast({
          title: "No folders found",
          description: "No Flex folders available for this job.",
          variant: "destructive",
        });
        return;
      }

      // Build options list: main folder + department folders
      const options: FlexElementOption[] = [];

      // Add main folder as first option
      options.push({
        elementId: mainElementId,
        label: "Main Event",
        department: null,
      });

      // Add department folders
      const departmentFolders = data.filter(
        (folder) =>
          folder.folder_type === "department" ||
          folder.folder_type === "tourdate" ||
          folder.folder_type === "dryhire"
      );

      departmentFolders.forEach((folder) => {
        const label = folder.department
          ? `${folder.department.charAt(0).toUpperCase()}${folder.department.slice(1)}`
          : folder.folder_type || "Unknown";
        options.push({
          elementId: folder.element_id,
          label,
          department: folder.department,
        });
      });

      setElementOptions(options);

      // Set default selection: prefer default department or main
      if (defaultDepartment) {
        const defaultOption = options.find(
          (opt) => opt.department === defaultDepartment
        );
        if (defaultOption) {
          setSelectedElementId(defaultOption.elementId);
        } else {
          setSelectedElementId(mainElementId);
        }
      } else {
        setSelectedElementId(mainElementId);
      }
    } catch (err) {
      console.error("Exception loading Flex folder options:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [jobId, mainElementId, defaultDepartment, toast]);

  useEffect(() => {
    if (open && mainElementId) {
      loadElementOptions();
    }
  }, [open, mainElementId, loadElementOptions]);

  const handleOpenInFlex = () => {
    if (!selectedElementId) {
      toast({
        title: "No selection",
        description: "Please select a Flex folder.",
        variant: "destructive",
      });
      return;
    }

    const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${selectedElementId}/view/simple-element/header`;
    window.open(flexUrl, "_blank", "noopener");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open in Flex</DialogTitle>
          <DialogDescription>
            Select which Flex folder to open.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="flex-element-select">Flex Folder</Label>
              <Select
                value={selectedElementId}
                onValueChange={setSelectedElementId}
              >
                <SelectTrigger id="flex-element-select">
                  <SelectValue placeholder="Select a folder" />
                </SelectTrigger>
                <SelectContent>
                  {elementOptions.map((option) => (
                    <SelectItem key={option.elementId} value={option.elementId}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleOpenInFlex}
            disabled={loading || !selectedElementId}
            className="gap-2"
          >
            <ExternalLink className="h-4 w-4" />
            Open in Flex
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
