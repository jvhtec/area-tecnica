import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, BellOff, Check, Loader2, Settings } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useFestivalPushSubscription } from "@/hooks/festival/useFestivalPushSubscription";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { cn } from "@/lib/utils";
import { normalizeFestivalStages } from "@/utils/festivalPushStages";

type FestivalPushFeedButtonProps = {
  jobId?: string;
  className?: string;
  compact?: boolean;
  onActivatePushClick?: () => void;
};

const sameStages = (left: number[], right: number[]) =>
  left.length === right.length && left.every((stage, index) => stage === right[index]);

export const FestivalPushFeedButton = ({
  jobId,
  className,
  compact = false,
  onActivatePushClick,
}: FestivalPushFeedButtonProps) => {
  const navigate = useNavigate();
  const push = usePushNotifications();
  const feed = useFestivalPushSubscription(jobId);
  const [open, setOpen] = useState(false);
  const [draftEnabled, setDraftEnabled] = useState(false);
  const [draftStages, setDraftStages] = useState<number[]>([]);

  const hasDevicePush = Boolean(push.subscription);
  const selectedStageKey = normalizeFestivalStages(feed.selectedStages).join(",");
  const selectedStages = useMemo(
    () => selectedStageKey ? selectedStageKey.split(",").map(Number) : [],
    [selectedStageKey],
  );

  useEffect(() => {
    setDraftEnabled(feed.subscription?.enabled ?? false);
    setDraftStages(selectedStages);
  }, [feed.subscription?.enabled, selectedStages]);

  if (!jobId) return null;

  const stageCount = feed.stageOptions.length;
  const isBusy = feed.isLoading || push.isInitializing;
  const isActive = hasDevicePush && feed.isSubscribed;
  const isDirty =
    draftEnabled !== (feed.subscription?.enabled ?? false) ||
    !sameStages(normalizeFestivalStages(draftStages), selectedStages);

  const handleToggleStage = (stage: number, checked: boolean) => {
    setDraftStages((current) => {
      if (checked) return normalizeFestivalStages([...current, stage]);
      return current.filter((item) => item !== stage);
    });
  };

  const handleProfileClick = () => {
    setOpen(false);
    if (onActivatePushClick) {
      onActivatePushClick();
      return;
    }
    navigate("/profile");
  };

  const handleSave = async () => {
    try {
      await feed.save({
        enabled: draftEnabled,
        stages: draftStages,
      });
      setOpen(false);
    } catch {
      // The mutation already shows the Spanish error toast.
    }
  };

  const triggerIcon = isBusy ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : isActive ? (
    <Bell className="h-4 w-4" />
  ) : (
    <BellOff className="h-4 w-4" />
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "default" : "outline"}
          size="sm"
          className={cn("relative flex items-center gap-2 hover:bg-accent/50 transition-all", className)}
          aria-label="Feed de avisos del festival"
        >
          {triggerIcon}
          {!compact && <span className="hidden sm:inline">Avisos</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Feed de avisos</div>
              <div className="text-xs text-muted-foreground">
                Notificaciones por escenario y horario
              </div>
            </div>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>

          {!hasDevicePush ? (
            <Alert>
              <Settings className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <span className="block">
                  Activa las notificaciones push en Perfil para suscribirte a este feed.
                </span>
                <Button type="button" size="sm" onClick={handleProfileClick}>
                  Ir a Perfil
                </Button>
              </AlertDescription>
            </Alert>
          ) : isBusy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando estado del feed...
            </div>
          ) : stageCount === 0 ? (
            <Alert>
              <AlertDescription>
                {feed.canChooseAnyStage
                  ? "No hay escenarios configurados para este festival."
                  : "No tienes escenarios asignados para este festival."}
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                <div>
                  <div className="text-sm font-medium">Feed activo</div>
                  <div className="text-xs text-muted-foreground">
                    Recibir avisos del festival
                  </div>
                </div>
                <Switch checked={draftEnabled} onCheckedChange={setDraftEnabled} />
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  Escenarios
                </div>
                <div className="space-y-2">
                  {feed.stageOptions.map((stage) => {
                    const checked = draftStages.includes(stage.number);
                    return (
                      <label
                        key={stage.number}
                        className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(value) => handleToggleStage(stage.number, value === true)}
                        />
                        <span className="min-w-0 flex-1 truncate">{stage.label}</span>
                        {checked && <Check className="h-4 w-4 text-primary" />}
                      </label>
                    );
                  })}
                </div>
              </div>

              {!feed.canChooseAnyStage && (
                <div className="text-xs text-muted-foreground">
                  Solo puedes suscribirte a escenarios donde tienes turno asignado.
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={feed.isSaving || !isDirty || (draftEnabled && draftStages.length === 0)}
                >
                  {feed.isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Guardar
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
