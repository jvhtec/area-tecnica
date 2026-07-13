import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { TransportRequestSummary } from "@/hooks/useJobTransportRequests";

type RequestItem = TransportRequestSummary["items"][number];

interface TransportRequestsManagerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requests: TransportRequestSummary[];
  // request is null when creating an event with no originating request
  onCreateEvent: (request: TransportRequestSummary | null, item?: RequestItem) => void;
  onCancelRequest: (requestId: string) => Promise<{ error: string | null }>;
  // Present when the manager also belongs to a tech department and can file
  // transport requests of their own
  onRequestTransport?: () => void;
}

/**
 * Logistics/management view of a job's pending transport requests: cancel
 * them or turn each requested vehicle into a logistics event.
 */
export function TransportRequestsManagerDialog({
  open,
  onOpenChange,
  requests,
  onCreateEvent,
  onCancelRequest,
  onRequestTransport,
}: TransportRequestsManagerDialogProps) {
  const { toast } = useToast();

  const handleCancelRequest = async (requestId: string) => {
    const { error } = await onCancelRequest(requestId);
    if (error) {
      toast({
        title: "No se pudo cancelar",
        description: error,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto sm:max-h-[85vh]">
        <div className="space-y-4">
          <div className="text-lg font-semibold">Solicitudes de transporte</div>
          {requests.length === 0 ? (
            <div className="space-y-3">
              <div className="text-muted-foreground">No hay solicitudes pendientes para este trabajo.</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onCreateEvent(null);
                  }}
                >
                  Crear evento
                </Button>
                {onRequestTransport && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onRequestTransport();
                    }}
                  >
                    Solicitar transporte
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="border rounded p-2 space-y-2">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-medium capitalize">{req.department}</div>
                        {req.is_hoja_relevant === false && (
                          <span className="text-xs rounded border px-1.5 py-0.5 text-muted-foreground">
                            Fuera de Hoja de Ruta
                          </span>
                        )}
                      </div>
                      {req.description && <div className="text-sm">{req.description}</div>}
                      {req.needed_date && (
                        <div className="text-xs text-muted-foreground">
                          Fecha necesaria: {req.needed_date.split("-").reverse().join("/")}
                        </div>
                      )}
                      {req.note && <div className="text-xs text-muted-foreground italic">{req.note}</div>}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        void handleCancelRequest(req.id);
                      }}
                    >
                      Cancelar solicitud
                    </Button>
                  </div>
                  <div className="space-y-1">
                    {(req.items || []).map((it) => (
                      <div
                        key={it.id}
                        className="flex flex-col items-start gap-2 pl-2 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="text-sm text-muted-foreground">
                          {it.transport_type.replace("_", " ")}
                          {typeof it.leftover_space_meters === "number" && (
                            <span className="ml-2">· Espacio libre: {it.leftover_space_meters} m</span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onCreateEvent(req, it);
                          }}
                        >
                          Crear evento
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {onRequestTransport && (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onRequestTransport();
                    }}
                  >
                    Solicitar transporte
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
