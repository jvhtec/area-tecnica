import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DEFAULT_FIXTURE_TYPE,
  FIXTURE_PF,
  type ConsumosLabels,
  type FixtureType,
} from "./config";
import type { CustomPowerComponentInput } from "./useCustomPowerComponents";

type CustomComponentDialogProps = {
  labels: ConsumosLabels;
  showFixtureType: boolean;
  onCreate: (input: CustomPowerComponentInput) => void;
};

export const CustomComponentDialog = ({
  labels,
  showFixtureType,
  onCreate,
}: CustomComponentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [watts, setWatts] = useState("");
  const [fixtureType, setFixtureType] =
    useState<FixtureType>(DEFAULT_FIXTURE_TYPE);

  const reset = () => {
    setName("");
    setWatts("");
    setFixtureType(DEFAULT_FIXTURE_TYPE);
  };

  const parsedWatts = Number(watts);
  const canSubmit =
    name.trim().length > 0 &&
    watts.trim().length > 0 &&
    Number.isFinite(parsedWatts) &&
    parsedWatts > 0;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;

    onCreate({
      name,
      watts: parsedWatts,
      ...(showFixtureType ? { fixtureType } : {}),
    });
    reset();
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={labels.addComponent}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>{labels.addComponent}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{labels.customComponentTitle}</DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="custom-component-name">{labels.componentName}</Label>
            <Input
              id="custom-component-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={labels.componentNamePlaceholder}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-component-watts">{labels.componentWatts}</Label>
            <Input
              id="custom-component-watts"
              type="number"
              min="1"
              step="1"
              value={watts}
              onChange={(event) => setWatts(event.target.value)}
            />
          </div>

          {showFixtureType && (
            <div className="space-y-2">
              <Label>{labels.componentType}</Label>
              <Select
                value={fixtureType}
                onValueChange={(value) => setFixtureType(value as FixtureType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(FIXTURE_PF) as [
                      FixtureType,
                      { label: string; pf: number },
                    ][]
                  ).map(([key, data]) => (
                    <SelectItem key={key} value={key}>
                      {data.label} ({data.pf.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {labels.saveComponent}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
