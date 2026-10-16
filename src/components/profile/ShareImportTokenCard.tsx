import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SUPABASE_URL } from "@/lib/api-config";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

type Device = {
  id: string;
  label: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};

const IMPORT_ENDPOINT = `${SUPABASE_URL}/functions/v1/ios-share-import`;

// These are scoped import credentials, not Supabase session or service-role
// tokens. The raw secret is shown exactly once; it is never stored in the PWA.
export function ShareImportTokenCard() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [label, setLabel] = useState("Mi iPhone");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const call = useCallback(async (action: string, extra: Record<string, string> = {}) => {
    const { data, error } = await supabase.functions.invoke("ios-share-import", {
      body: { action, ...extra },
    });
    if (error || !data?.ok) throw new Error(data?.error || error?.message || "Error del servidor");
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const result = await call("devices");
      setDevices(Array.isArray(result.devices) ? result.devices : []);
    } catch (error) {
      toast({
        title: "No se pudieron cargar los dispositivos",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setLoaded(true);
    }
  }, [call, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  const create = async () => {
    setLoading(true);
    setNewToken(null);
    try {
      const result = await call("pair", { label });
      setNewToken(result.token);
      await refresh();
    } catch (error) {
      toast({
        title: "Error al crear la conexión",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally { setLoading(false); }
  };

  const revoke = async (id: string) => {
    setLoading(true);
    try {
      await call("revoke", { token_id: id });
      setNewToken(null);
      await refresh();
      toast({ title: "Dispositivo revocado" });
    } catch (error) {
      toast({
        title: "Error al revocar",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally { setLoading(false); }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copiado al portapapeles" });
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar documentos desde iOS</CardTitle>
        <CardDescription>
          Vincula un atajo de iPhone para enviar adjuntos de Outlook a un trabajo.
          El permiso sirve solo para importar documentos y caduca en 90 días.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            aria-label="Nombre del dispositivo"
            maxLength={80}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Mi iPhone"
          />
          <Button disabled={loading || !label.trim()} onClick={() => void create()}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Crear conexión
          </Button>
        </div>
        {newToken && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="font-medium text-sm">Copia esta clave ahora. No se volverá a mostrar.</p>
            <div className="break-all font-mono text-xs select-all">{newToken}</div>
            <Button size="sm" variant="outline" onClick={() => void copy(newToken)}>
              <Copy className="mr-2 h-4 w-4" /> Copiar clave
            </Button>
            <p className="text-xs text-muted-foreground">
              Guarda la clave solo en tu atajo personal. No compartas un enlace público
              de Shortcuts que contenga esta clave.
            </p>
          </div>
        )}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Dirección de la API para el atajo</p>
          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all text-xs">{IMPORT_ENDPOINT}</code>
            <Button size="sm" variant="outline" aria-label="Copiar dirección de la API"
              onClick={() => void copy(IMPORT_ENDPOINT)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Dispositivos vinculados</p>
          {!loaded && <Loader2 className="h-4 w-4 animate-spin" />}
          {loaded && devices.length === 0 && <p className="text-xs text-muted-foreground">Ninguno todavía</p>}
          {devices.map((device) => {
            const inactive = Boolean(device.revoked_at) || new Date(device.expires_at).getTime() <= Date.now();
            return (
              <div key={device.id} className="flex items-center justify-between gap-2 rounded border p-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{device.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {inactive ? "Inactivo" : `Válido hasta ${new Date(device.expires_at).toLocaleDateString("es-ES")}`}
                    {device.last_used_at && ` · Último uso ${new Date(device.last_used_at).toLocaleDateString("es-ES")}`}
                  </div>
                </div>
                {!inactive && (
                  <Button size="sm" variant="outline" disabled={loading}
                    aria-label={`Revocar ${device.label}`} onClick={() => void revoke(device.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
