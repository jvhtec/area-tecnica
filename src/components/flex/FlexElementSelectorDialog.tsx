import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Loader2, FolderTree, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getElementTree,
  searchTree,
  flattenTree,
  filterTreeWithAncestors,
  type FlexElementNode,
  type FlatElementNode,
  type TreeFilterPredicate,
} from "@/utils/flex-folders";

interface FlexElementSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mainElementId: string;
  defaultElementId?: string;
  onSelect: (elementId: string) => void;
  filterPredicate?: TreeFilterPredicate;
}

export const FlexElementSelectorDialog: React.FC<
  FlexElementSelectorDialogProps
> = ({ open, onOpenChange, mainElementId, defaultElementId, onSelect, filterPredicate }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: treeData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<FlexElementNode[], Error>({
    queryKey: ["flexElementTree", mainElementId],
    queryFn: () => getElementTree(mainElementId),
    enabled: open && !!mainElementId,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });

  const flattenedNodes = useMemo(() => {
    if (!treeData) return [];

    // Apply filter predicate first if provided
    let filteredTree = treeData;
    if (filterPredicate) {
      filteredTree = filterTreeWithAncestors(treeData, filterPredicate);
    }

    // Then apply search query if present
    if (searchQuery.trim()) {
      return searchTree(filteredTree, searchQuery);
    }

    return flattenTree(filteredTree);
  }, [treeData, searchQuery, filterPredicate]);

  const handleSelect = (elementId: string) => {
    onSelect(elementId);
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleCancel = () => {
    onOpenChange(false);
    setSearchQuery("");
  };

  const renderNode = (node: FlatElementNode) => {
    const isDefault = node.elementId === defaultElementId;
    const indent = node.depth * 16;

    return (
      <CommandItem
        key={node.elementId}
        value={`${node.elementId}-${node.displayName}-${node.documentNumber || ""}`}
        onSelect={() => handleSelect(node.elementId)}
        className={cn(
          "cursor-pointer",
          isDefault && "bg-accent/50 font-medium"
        )}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {node.depth === 0 ? (
            <FolderTree className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          ) : (
            <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          )}
          <div className="flex flex-col flex-1 min-w-0">
            <span className="truncate">{node.displayName}</span>
            {node.documentNumber && (
              <span className="text-xs text-muted-foreground truncate">
                {node.documentNumber}
              </span>
            )}
          </div>
          {isDefault && (
            <span className="text-xs text-muted-foreground flex-shrink-0">
              (default)
            </span>
          )}
        </div>
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Flex Element</DialogTitle>
          <DialogDescription>
            {filterPredicate
              ? "Choose an element for this tour date to open in Flex."
              : "Choose an element from the tree to open in Flex."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Loading element tree...
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <div className="text-center space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Failed to load element tree
                </p>
                <p className="text-xs text-muted-foreground">
                  {error?.message || "An unexpected error occurred"}
                </p>
              </div>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Retry
              </Button>
            </div>
          ) : (
            <Command className="rounded-lg border">
              <CommandInput
                placeholder="Search elements..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList className="max-h-[400px]">
                <CommandEmpty>
                  {searchQuery
                    ? "No elements found matching your search."
                    : "No elements available."}
                </CommandEmpty>
                <CommandGroup>
                  {flattenedNodes.map((node) => renderNode(node))}
                </CommandGroup>
              </CommandList>
            </Command>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
