import { useState } from "react";
import { Check, Edit2, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface StageSelectorProps {
  stages: Array<{ number: number; name: string }>;
  selectedStage: number;
  onSelectStage: (stageNumber: number) => void;
  /** Stages that have their own gear override. */
  customStageNumbers: number[];
  canManage: boolean;
  onAddStage: () => void;
  isAddingStage: boolean;
  onRenameStage: (stageNumber: number, name: string) => Promise<void>;
}

/** The stage tabs of the gear page, with add and rename for people who can manage gear. */
export const StageSelector = ({
  stages,
  selectedStage,
  onSelectStage,
  customStageNumbers,
  canManage,
  onAddStage,
  isAddingStage,
  onRenameStage,
}: StageSelectorProps) => {
  const [editingStage, setEditingStage] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");

  const startEdit = (stage: { number: number; name: string }) => {
    if (!canManage) return;
    setEditingStage(stage.number);
    setEditingName(stage.name);
  };

  const cancelEdit = () => {
    setEditingStage(null);
    setEditingName("");
  };

  const saveEdit = async () => {
    const name = editingName.trim();
    const stageNumber = editingStage;
    cancelEdit();
    if (!canManage || stageNumber === null || !name) return;
    try {
      await onRenameStage(stageNumber, name);
    } catch {
      // The hook already reported the failure to the user.
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="space-y-2">
            <CardTitle>Configuración de Escenarios</CardTitle>
            <CardDescription>
              Configura los escenarios para tu festival. Haz clic en el nombre de un escenario para editarlo.
            </CardDescription>
          </div>
          {canManage && (
            <Button onClick={onAddStage} disabled={isAddingStage} size="sm" className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              Añadir Escenario
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3">
          {stages.map((stage) => (
            <div key={stage.number} className="relative">
              <Button
                variant={selectedStage === stage.number ? "default" : "outline"}
                onClick={() => onSelectStage(stage.number)}
                className="px-4 md:px-6 flex items-center gap-2 text-sm md:text-base"
              >
                <span className="truncate max-w-[120px] md:max-w-none">{stage.name}</span>
                {customStageNumbers.includes(stage.number) && (
                  <Badge variant="outline" className="ml-1 md:ml-2 bg-blue-100 text-xs">
                    Personalizado
                  </Badge>
                )}
              </Button>

              {editingStage === stage.number ? (
                <div className="fixed md:absolute top-1/2 left-1/2 md:top-full md:left-0 -translate-x-1/2 -translate-y-1/2 md:translate-x-0 md:translate-y-0 md:mt-2 p-4 md:p-2 bg-popover text-popover-foreground border rounded-md shadow-lg z-50 w-[90vw] md:w-auto md:min-w-[200px]">
                  <Input
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                    placeholder="Nombre del escenario"
                    className="mb-2"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") void saveEdit();
                      if (event.key === "Escape") cancelEdit();
                    }}
                    autoFocus
                  />
                  <div className="flex gap-2 md:gap-1">
                    <Button size="sm" onClick={() => void saveEdit()} className="flex-1 md:flex-initial">
                      <Check className="h-3 w-3 mr-2 md:mr-0" />
                      <span className="md:hidden">Guardar</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1 md:flex-initial">
                      <X className="h-3 w-3 mr-2 md:mr-0" />
                      <span className="md:hidden">Cancelar</span>
                    </Button>
                  </div>
                </div>
              ) : canManage ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="absolute -top-1 -right-1 h-6 w-6 p-0"
                  onClick={() => startEdit(stage)}
                >
                  <Edit2 className="h-3 w-3" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
