import { Dialog, DialogContent } from "@/components/ui/dialog";
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
      <DialogContent className="max-w-xl">
        <div className="space-y-4">
          <div className="text-lg font-semibold">Solicitudes de transporte</div>
          {requests.length === 0 ? (
            <div className="space-y-3">
              <div className="text-muted-foreground">No hay solicitudes pendientes para este trabajo.</div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 text-sm rounded border hover:bg-accent w-fit"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    onCreateEvent(null);
                  }}
                >
                  Crear evento
                </button>
                {onRequestTransport && (
                  <button
                    className="px-3 py-1 text-sm rounded border hover:bg-accent w-fit"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onRequestTransport();
                    }}
                  >
                    Solicitar transporte
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {requests.map((req) => (
                <div key={req.id} className="border rounded p-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
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
                    <button
                      className="px-3 py-1 text-sm rounded border hover:bg-accent"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        void handleCancelRequest(req.id);
                      }}
                    >
                      Cancelar solicitud
                    </button>
                  </div>
                  <div className="space-y-1">
                    {(req.items || []).map((it) => (
                      <div key={it.id} className="flex items-center justify-between pl-2">
                        <div className="text-sm text-muted-foreground">
                          {it.transport_type.replace("_", " ")}
                          {typeof it.leftover_space_meters === "number" && (
                            <span className="ml-2">· Espacio libre: {it.leftover_space_meters} m</span>
                          )}
                        </div>
                        <button
                          className="px-3 py-1 text-sm rounded border hover:bg-accent"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            onCreateEvent(req, it);
                          }}
                        >
                          Crear evento
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {onRequestTransport && (
                <div className="flex justify-end pt-1">
                  <button
                    className="px-3 py-1 text-sm rounded border hover:bg-accent"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      onRequestTransport();
                    }}
                  >
                    Solicitar transporte
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
