import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, FolderPlus, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface FolderStructureItem {
  name: string;
  subfolders?: string[];
}

export type FolderStructure = string[] | FolderStructureItem[];

interface FolderStructureEditorProps {
  value: FolderStructure | null;
  onChange: (structure: FolderStructure) => void;
  title?: string;
  description?: string;
}

const DEFAULT_STRUCTURE: string[] = [
  "CAD",
  "QT", 
  "Material",
  "Documentación",
  "Rentals",
  "Compras",
  "Rider",
  "Predicciones"
];

const TOUR_SPECIAL_ELEMENTS = [
  { name: "tourdates", description: "Creates folders for each tour date with naming: yymmdd - Location, show type" }
];

export const FolderStructureEditor = ({ value, onChange, title = "Custom Folder Structure", description = "Customize the folder structure that will be created in your local system." }: FolderStructureEditorProps) => {
  const isTourStructure = title.toLowerCase().includes('tour');
  const { toast } = useToast();
  const [newFolderName, setNewFolderName] = useState("");
  
  // Convert value to consistent format for editing
  const currentStructure: FolderStructureItem[] = value 
    ? (Array.isArray(value) && typeof value[0] === 'string'
        ? (value as string[]).map(name => ({ name, subfolders: ["OLD"] }))
        : value as FolderStructureItem[])
    : DEFAULT_STRUCTURE.map(name => ({ name, subfolders: ["OLD"] }));

  const addFolder = () => {
    if (!newFolderName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a folder name",
        variant: "destructive",
      });
      return;
    }

    if (currentStructure.some(folder => folder.name === newFolderName.trim())) {
      toast({
        title: "Error", 
        description: "Folder name already exists",
        variant: "destructive",
      });
      return;
    }

    const newStructure = [...currentStructure, { name: newFolderName.trim(), subfolders: ["OLD"] }];
    onChange(newStructure);
    setNewFolderName("");
  };

  const removeFolder = (index: number) => {
    const newStructure = currentStructure.filter((_, i) => i !== index);
    onChange(newStructure);
  };

  const updateFolderName = (index: number, newName: string) => {
    if (!newName.trim()) return;
    
    const newStructure = [...currentStructure];
    newStructure[index] = { ...newStructure[index], name: newName.trim() };
    onChange(newStructure);
  };

  const addSubfolder = (folderIndex: number, subfolderName: string) => {
    if (!subfolderName.trim()) return;
    
    const newStructure = [...currentStructure];
    const currentSubfolders = newStructure[folderIndex].subfolders || [];
    
    if (currentSubfolders.includes(subfolderName.trim())) {
      toast({
        title: "Error",
        description: "Subfolder already exists",
        variant: "destructive",
      });
      return;
    }
    
    newStructure[folderIndex] = {
      ...newStructure[folderIndex],
      subfolders: [...currentSubfolders, subfolderName.trim()]
    };
    onChange(newStructure);
  };

  const removeSubfolder = (folderIndex: number, subfolderIndex: number) => {
    const newStructure = [...currentStructure];
    const currentSubfolders = newStructure[folderIndex].subfolders || [];
    newStructure[folderIndex] = {
      ...newStructure[folderIndex],
      subfolders: currentSubfolders.filter((_, i) => i !== subfolderIndex)
    };
    onChange(newStructure);
  };

  const resetToDefault = () => {
    onChange(DEFAULT_STRUCTURE.map(name => ({ name, subfolders: ["OLD"] })));
    toast({
      title: "Success",
      description: "Reset to default folder structure",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <FolderPlus className="h-5 w-5" />
            {title}
          </span>
          <Button variant="outline" size="sm" onClick={resetToDefault}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Default
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {description}
        </div>

        {/* Current folders */}
        <div className="space-y-3">
          {currentStructure.map((folder, folderIndex) => (
            <FolderItem
              key={folderIndex}
              folder={folder}
              onUpdateName={(newName) => updateFolderName(folderIndex, newName)}
              onRemove={() => removeFolder(folderIndex)}
              onAddSubfolder={(name) => addSubfolder(folderIndex, name)}
              onRemoveSubfolder={(subIndex) => removeSubfolder(folderIndex, subIndex)}
            />
          ))}
        </div>

        {/* Special tour elements */}
        {isTourStructure && (
          <div className="mb-4 p-3 bg-muted/30 rounded-lg border-dashed border">
            <div className="text-sm font-medium mb-2">Special Tour Elements:</div>
            <div className="space-y-2">
              {TOUR_SPECIAL_ELEMENTS.map((element) => (
                <div key={element.name} className="flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2">{element.name}</Badge>
                    <span className="text-xs text-muted-foreground">{element.description}</span>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      if (currentStructure.some(folder => folder.name === element.name)) {
                        toast({
                          title: "Error",
                          description: "Element already exists",
                          variant: "destructive",
                        });
                        return;
                      }
                      const newStructure = [...currentStructure, { name: element.name, subfolders: [] }];
                      onChange(newStructure);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add new folder */}
        <div className="flex gap-2 pt-4 border-t">
          <Input
            placeholder="New folder name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFolder()}
          />
          <Button onClick={addFolder} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Folder
          </Button>
        </div>

        {/* Preview */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <div className="text-sm font-medium mb-2">Preview:</div>
          <div className="text-xs text-muted-foreground space-y-1">
            {currentStructure.map((folder) => (
              <div key={folder.name}>
                📁 {folder.name}
                {folder.name === 'tourdates' && isTourStructure ? (
                  <div className="ml-4 text-blue-600">
                    <div>📁 250125 - Madrid - Show</div>
                    {folder.subfolders?.map((sub) => (
                      <div key={sub} className="ml-8">📁 {sub}</div>
                    ))}
                    <div>📁 250126 - Barcelona - Show</div>
                    {folder.subfolders?.map((sub) => (
                      <div key={sub} className="ml-8">📁 {sub}</div>
                    ))}
                    <div className="ml-4 text-muted-foreground italic">... (one folder per tour date)</div>
                  </div>
                ) : (
                  folder.subfolders?.map((sub) => (
                    <div key={sub} className="ml-4">📁 {sub}</div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

interface FolderItemProps {
  folder: FolderStructureItem;
  onUpdateName: (name: string) => void;
  onRemove: () => void;
  onAddSubfolder: (name: string) => void;
  onRemoveSubfolder: (index: number) => void;
}

const FolderItem = ({ folder, onUpdateName, onRemove, onAddSubfolder, onRemoveSubfolder }: FolderItemProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [newSubfolder, setNewSubfolder] = useState("");

  const handleSaveName = () => {
    onUpdateName(editName);
    setIsEditing(false);
  };

  const handleAddSubfolder = () => {
    if (newSubfolder.trim()) {
      onAddSubfolder(newSubfolder);
      setNewSubfolder("");
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {isEditing ? (
          <div className="flex-1 flex gap-2">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              autoFocus
            />
            <Button size="sm" onClick={handleSaveName}>Save</Button>
            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        ) : (
          <>
            <div 
              className="flex-1 font-medium cursor-pointer hover:text-primary flex items-center gap-2"
              onClick={() => setIsEditing(true)}
            >
              📁 {folder.name}
              {folder.name === 'tourdates' && (
                <Badge variant="secondary" className="text-xs">Special</Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Subfolders */}
      {folder.subfolders && folder.subfolders.length > 0 && (
        <div className="ml-4 space-y-1">
          {folder.subfolders.map((subfolder, index) => (
            <div key={index} className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                📁 {subfolder}
              </Badge>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveSubfolder(index)}
                className="h-6 w-6 p-0"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add subfolder */}
      <div className="ml-4 flex gap-2">
        <Input
          placeholder="Add subfolder"
          value={newSubfolder}
          onChange={(e) => setNewSubfolder(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddSubfolder()}
          className="text-xs"
          size={10}
        />
        <Button size="sm" variant="outline" onClick={handleAddSubfolder}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};