import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOptimizedAuth } from "@/hooks/useOptimizedAuth";
import { toast } from "@/hooks/use-toast";
import { invalidateFlexTokenCache } from "@/utils/flexTokenCache";

export function FlexApiKeySettings() {
  const { userId } = useOptimizedAuth();
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("flex_api_key")
        .eq("id", userId)
        .single();

      if (!cancelled) {
        setApiKey(data?.flex_api_key || "");
        setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  const handleSave = async () => {
    if (!userId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ flex_api_key: apiKey.trim() || null })
        .eq("id", userId);

      if (error) throw error;

      // Clear cached tokens so the new key takes effect immediately
      invalidateFlexTokenCache();

      toast({
        title: "Flex API Key guardada",
        description: apiKey.trim()
          ? "Tus operaciones de Flex usarán tu clave personal."
          : "Se ha eliminado tu clave personal. Se usará la clave global.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo guardar",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="flex-api-key">Clave API de Flex (X-Auth-Token)</Label>
        <Input
          id="flex-api-key"
          type="password"
          placeholder="Tu clave personal de Flex API"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Si configuras tu propia clave, las operaciones de Flex que realices usarán
          esta clave en lugar de la global compartida. Esto ayuda a distribuir las
          llamadas API y evitar el límite de 2000/hora.
        </p>
      </div>
      <Button
        onClick={handleSave}
        disabled={isSaving}
        size="sm"
      >
        {isSaving ? "Guardando..." : "Guardar"}
      </Button>
    </div>
  );
}
