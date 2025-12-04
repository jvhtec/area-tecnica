
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEquipmentModels } from "@/hooks/useEquipmentModels";
import { useDepartment } from "@/contexts/DepartmentContext";
import { getModelCategoriesForDepartment } from "@/types/equipment";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface CreateEquipmentModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
}

export const CreateEquipmentModelDialog = ({
  open,
  onOpenChange,
  defaultCategory
}: CreateEquipmentModelDialogProps) => {
  const { department } = useDepartment();
  const categories = getModelCategoriesForDepartment(department);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [category, setCategory] = useState(defaultCategory || categories[0]?.value || '');
  const [resourceId, setResourceId] = useState("");
  const [imageId, setImageId] = useState("");
  const [flexUrl, setFlexUrl] = useState("");
  const [isFetchingFlex, setIsFetchingFlex] = useState(false);
  const { createModel, isCreating } = useEquipmentModels();

  useEffect(() => {
    if (defaultCategory) {
      setCategory(defaultCategory);
    } else if (categories[0]) {
      setCategory(categories[0].value);
    }
  }, [defaultCategory, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    createModel({
      name: name.trim(),
      category,
      resource_id: resourceId.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined,
      image_id: imageId.trim() || undefined
    });
    setName("");
    setManufacturer("");
    setCategory(defaultCategory || categories[0]?.value || '');
    setResourceId("");
    setImageId("");
    setFlexUrl("");
    onOpenChange(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName("");
      setManufacturer("");
      setCategory(defaultCategory || categories[0]?.value || '');
      setResourceId("");
      setImageId("");
      setFlexUrl("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Equipment Model</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Model Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter model name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input
              id="manufacturer"
              value={manufacturer}
              onChange={(e) => setManufacturer(e.target.value)}
              placeholder="Enter manufacturer (optional)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-3 border rounded-md p-3">
            <div className="space-y-2">
              <Label htmlFor="resourceId">Flex Resource ID (optional)</Label>
              <Input
                id="resourceId"
                type="text"
                placeholder="adcf7550-4fa3-11eb-815f-2a0a4490a7fb"
                value={resourceId}
                onChange={(e) => setResourceId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="flexUrl">Flex URL (paste and extract)</Label>
              <div className="flex gap-2">
                <Input
                  id="flexUrl"
                  type="text"
                  placeholder="https://sectorpro.flexrentalsolutions.com/f5/ui/#inventory-model/UUID/quantity"
                  value={flexUrl}
                  onChange={(e) => setFlexUrl(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
                    const m = (flexUrl || '').match(uuidRe)?.[0];
                    if (m) setResourceId(m);
                  }}
                >
                  Extract
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      const clip = await navigator.clipboard.readText();
                      const uuidRe = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;
                      const m = (clip || '').match(uuidRe)?.[0];
                      setFlexUrl(clip);
                      if (m) setResourceId(m);
                    } catch (_) {
                      // ignore
                    }
                  }}
                >
                  Paste URL
                </Button>
                <Button
                  type="button"
                  variant="default"
                  disabled={isFetchingFlex || !(resourceId || flexUrl)}
                  onClick={async () => {
                    try {
                      setIsFetchingFlex(true);
                      const { data, error } = await supabase.functions.invoke('fetch-flex-inventory-model', {
                        body: resourceId
                          ? { model_id: resourceId }
                          : { url: flexUrl }
                      });
                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);
                      const m = data?.mapped || {};
                      setName(m.name || name);
                      setManufacturer(m.manufacturer || manufacturer);
                      setResourceId(data?.model_id || resourceId);
                      setImageId(m.imageId || imageId);
                      toast({ title: 'Fetched from Flex', description: 'Equipment data has been auto-filled.' });
                    } catch (e: any) {
                      toast({ title: 'Failed to fetch from Flex', description: e?.message || 'Unknown error', variant: 'destructive' });
                    } finally {
                      setIsFetchingFlex(false);
                    }
                  }}
                >
                  {isFetchingFlex ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Fetching…
                    </>
                  ) : (
                    'Fetch from Flex'
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Example: https://sectorpro.flexrentalsolutions.com/f5/ui/#inventory-model/adcf7550-4fa3-11eb-815f-2a0a4490a7fb/quantity
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
