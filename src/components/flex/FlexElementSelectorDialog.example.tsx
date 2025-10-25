/**
 * Example usage of FlexElementSelectorDialog component
 * 
 * This example demonstrates how to integrate the dialog into a component
 * to allow users to select a Flex element from a hierarchical tree.
 */

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { FlexElementSelectorDialog } from "./FlexElementSelectorDialog";
import { FolderTree } from "lucide-react";

interface ExampleComponentProps {
  mainElementId: string;
  defaultElementId?: string;
}

export function ExampleFlexSelector({
  mainElementId,
  defaultElementId,
}: ExampleComponentProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSelectElement = (elementId: string) => {
    console.log("Selected element:", elementId);
    
    // Example: Open the selected element in Flex
    const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${elementId}/view/simple-element/header`;
    window.open(flexUrl, "_blank", "noopener");
    
    // Or handle the selection in another way (e.g., save to state, trigger an action, etc.)
  };

  return (
    <div>
      <Button onClick={() => setDialogOpen(true)} className="gap-2">
        <FolderTree className="h-4 w-4" />
        Select Flex Element
      </Button>

      <FlexElementSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mainElementId={mainElementId}
        defaultElementId={defaultElementId}
        onSelect={handleSelectElement}
      />
    </div>
  );
}

/**
 * Example with conditional rendering based on available data
 */
export function ConditionalFlexSelector({
  job,
}: {
  job: {
    id: string;
    flex_folders?: Array<{
      element_id: string;
      folder_type: string;
      department?: string;
    }>;
  };
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Find the main element
  const mainFolder = job.flex_folders?.find(
    (f) => f.folder_type === "main_event" || f.folder_type === "main"
  );

  // Find the default element (e.g., user's department)
  const userDepartment = "sound"; // This would come from auth context
  const defaultFolder = job.flex_folders?.find(
    (f) => f.folder_type === "department" && f.department === userDepartment
  );

  if (!mainFolder) {
    return (
      <Button disabled>
        No Flex folders available
      </Button>
    );
  }

  const handleSelectElement = (elementId: string) => {
    // Navigate to the selected element
    const flexUrl = `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/${elementId}/view/simple-element/header`;
    window.open(flexUrl, "_blank", "noopener");
  };

  return (
    <div>
      <Button onClick={() => setDialogOpen(true)} className="gap-2">
        <FolderTree className="h-4 w-4" />
        Open in Flex
      </Button>

      <FlexElementSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mainElementId={mainFolder.element_id}
        defaultElementId={defaultFolder?.element_id}
        onSelect={handleSelectElement}
      />
    </div>
  );
}

/**
 * Example with custom action after selection
 */
export function FlexSelectorWithCustomAction() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelectElement = (elementId: string) => {
    setSelectedId(elementId);
    
    // You can perform any custom action here
    // For example: save to backend, update local state, trigger workflow, etc.
    console.log("Element selected:", elementId);
    
    // Example: Make an API call
    // await fetch('/api/save-selected-element', {
    //   method: 'POST',
    //   body: JSON.stringify({ jobId: '123', elementId })
    // });
  };

  return (
    <div>
      <Button onClick={() => setDialogOpen(true)}>
        Select Element
      </Button>
      
      {selectedId && (
        <p className="text-sm text-muted-foreground mt-2">
          Selected: {selectedId}
        </p>
      )}

      <FlexElementSelectorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mainElementId="example-main-element-id"
        onSelect={handleSelectElement}
      />
    </div>
  );
}
