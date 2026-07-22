import { ClipboardPaste, Download, Link, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { allCategoryLabels, type AllCategories } from '@/types/equipment';

interface StockAdvancedEditDialogProps {
  open: boolean;
  onClose: () => void;
  categories: readonly string[];
  name: string;
  onNameChange: (value: string) => void;
  manufacturer: string;
  onManufacturerChange: (value: string) => void;
  category: string;
  onCategoryChange: (value: string) => void;
  resourceId: string;
  onResourceIdChange: (value: string) => void;
  flexUrl: string;
  onFlexUrlChange: (value: string) => void;
  imageId: string;
  onImageIdChange: (value: string) => void;
  showFlexSection: boolean;
  onShowFlexSectionChange: (open: boolean) => void;
  isFetchingFlex: boolean;
  isSaving: boolean;
  onPasteFlexUrl: () => void;
  onFetchFlex: () => void;
  onSave: () => void;
}

export function StockAdvancedEditDialog({
  open,
  onClose,
  categories,
  name,
  onNameChange,
  manufacturer,
  onManufacturerChange,
  category,
  onCategoryChange,
  resourceId,
  onResourceIdChange,
  flexUrl,
  onFlexUrlChange,
  imageId,
  onImageIdChange,
  showFlexSection,
  onShowFlexSectionChange,
  isFetchingFlex,
  isSaving,
  onPasteFlexUrl,
  onFetchFlex,
  onSave,
}: StockAdvancedEditDialogProps) {
  const fieldsDisabled = isFetchingFlex || isSaving;

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => !nextOpen && !isSaving && onClose()}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Equipo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="adv-name">Nombre del Equipo</Label>
            <Input
              id="adv-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Nombre del equipo"
              className="mt-1"
              disabled={fieldsDisabled}
            />
          </div>
          <div>
            <Label htmlFor="adv-manufacturer">Fabricante</Label>
            <Input
              id="adv-manufacturer"
              value={manufacturer}
              onChange={(event) => onManufacturerChange(event.target.value)}
              placeholder="Fabricante (opcional)"
              className="mt-1"
              disabled={fieldsDisabled}
            />
          </div>
          <div>
            <Label>Categoría</Label>
            <Select value={category} onValueChange={onCategoryChange} disabled={fieldsDisabled}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((item) => (
                  <SelectItem key={item} value={item}>
                    {allCategoryLabels[item as AllCategories] || item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Collapsible
            open={showFlexSection}
            onOpenChange={(nextOpen) => !isSaving && onShowFlexSectionChange(nextOpen)}
          >
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isSaving}
              >
                <Link className="mr-2 h-4 w-4" />
                {showFlexSection ? 'Ocultar integración Flex' : 'Integración con Flex (opcional)'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 mt-3 border rounded-md p-3">
              <div>
                <Label htmlFor="adv-resourceId">Flex Resource ID</Label>
                <Input
                  id="adv-resourceId"
                  value={resourceId}
                  onChange={(event) => onResourceIdChange(event.target.value)}
                  placeholder="UUID del recurso en Flex"
                  className="mt-1"
                  disabled={fieldsDisabled}
                />
              </div>
              <div>
                <Label>URL de Flex</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={flexUrl}
                    onChange={(event) => onFlexUrlChange(event.target.value)}
                    placeholder="Pegar URL de Flex"
                    disabled={fieldsDisabled}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onPasteFlexUrl}
                    disabled={fieldsDisabled}
                    title="Pegar URL"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={onFetchFlex}
                    disabled={fieldsDisabled || (!resourceId && !flexUrl)}
                  >
                    {isFetchingFlex ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    {isFetchingFlex ? 'Obteniendo...' : 'Obtener'}
                  </Button>
                </div>
              </div>
              <div>
                <Label htmlFor="adv-imageId">Image ID</Label>
                <Input
                  id="adv-imageId"
                  value={imageId}
                  onChange={(event) => onImageIdChange(event.target.value)}
                  placeholder="ID de imagen de Flex"
                  className="mt-1"
                  disabled={fieldsDisabled}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => !isSaving && onClose()}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSave}
            disabled={!name.trim() || isSaving || isFetchingFlex}
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
