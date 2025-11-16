import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { Download, Link2, Printer, Save } from "lucide-react";
import { Database } from "@/integrations/supabase/types";

import { buildZplLabel } from "@/constants/zebra-label";
import { getCategoriesForDepartment, type Department } from "@/types/equipment";

const getPublicBaseUrl = () => {
  if (import.meta.env.VITE_PUBLIC_APP_URL) {
    return import.meta.env.VITE_PUBLIC_APP_URL as string;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
};

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9-_]/g, "_");

export const EquipmentQrTools = ({ department }: { department: string }) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [qrCache, setQrCache] = useState<Record<string, string>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, { barcode?: string; stencil?: string }>>({});

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment-qr', department],
    queryFn: async () => {
      const categories = department ? getCategoriesForDepartment(department as Department) : [];
      let query = supabase
        .from('equipment')
        .select('id, name, department, barcode_number, stencil_number, category')
        .order('name');

      if (categories.length > 0) {
        query = query.in('category', categories as string[]);
      } else if (department) {
        query = query.eq('department', department);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, barcode_number, stencil_number }: { id: string; barcode_number?: string | null; stencil_number?: string | null }) => {
      const { error } = await supabase
        .from('equipment')
        .update({ barcode_number, stencil_number })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-qr', department] });
      toast({ title: 'Identificadores guardados', description: 'Los códigos se actualizaron correctamente.' });
    },
    onError: (error) => {
      console.error('Error updating equipment identifiers', error);
      toast({ title: 'Error', description: 'No se pudieron guardar los identificadores.', variant: 'destructive' });
    }
  });

  const ensureQr = async (equipmentId: string, url: string) => {
    if (qrCache[equipmentId]) {
      return qrCache[equipmentId];
    }
    const dataUrl = await QRCode.toDataURL(url, { width: 240, margin: 1 });
    setQrCache(prev => ({ ...prev, [equipmentId]: dataUrl }));
    return dataUrl;
  };

  const handleDownloadQr = async (equipment: Database['public']['Tables']['equipment']['Row']) => {
    const publicUrl = `${getPublicBaseUrl()}/public/incident/${equipment.id}`;
    const dataUrl = await ensureQr(equipment.id, publicUrl);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `QR_${sanitizeFileName(equipment.name)}.png`;
    a.click();
  };

  const handleCopyUrl = async (equipment: Database['public']['Tables']['equipment']['Row']) => {
    const publicUrl = `${getPublicBaseUrl()}/public/incident/${equipment.id}`;
    await navigator.clipboard.writeText(publicUrl);
    toast({ title: 'Enlace copiado', description: 'URL pública copiada al portapapeles.' });
  };

  const handleDownloadZpl = (equipment: Database['public']['Tables']['equipment']['Row']) => {
    const publicUrl = `${getPublicBaseUrl()}/public/incident/${equipment.id}`;
    const zpl = buildZplLabel({
      equipmentName: equipment.name,
      url: publicUrl,
      barcode: equipment.barcode_number || fieldDrafts[equipment.id]?.barcode || '',
      stencil: equipment.stencil_number || fieldDrafts[equipment.id]?.stencil || ''
    });
    const blob = new Blob([zpl], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${sanitizeFileName(equipment.name)}.zpl`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const handlePrintZebra = (equipment: Database['public']['Tables']['equipment']['Row']) => {
    handleDownloadZpl(equipment);
    toast({ title: 'Plantilla ZPL lista', description: 'Descarga el archivo .zpl e imprímelo desde tu utilidad Zebra.' });
  };

  const saveIdentifiers = (equipment: Database['public']['Tables']['equipment']['Row']) => {
    const drafts = fieldDrafts[equipment.id] || {};
    updateMutation.mutate({
      id: equipment.id,
      barcode_number: drafts.barcode ?? equipment.barcode_number ?? null,
      stencil_number: drafts.stencil ?? equipment.stencil_number ?? null
    });
  };

  const equipmentList = useMemo(() => equipment ?? [], [equipment]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Códigos QR públicos</CardTitle>
        <CardDescription>
          Actualiza los números de código de barras y stencil, genera QR en español y prepara etiquetas ZPL para impresoras Zebra.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando equipos...</div>
        ) : equipmentList.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No hay equipos registrados para este departamento o sus categorías.
          </div>
        ) : (
          equipmentList.map(item => (
            <div key={item.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-semibold">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">Departamento: {item.department}</p>
                </div>
                <Badge variant="outline">QR</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Código de barras</Label>
                  <Input
                    placeholder="123456"
                    value={fieldDrafts[item.id]?.barcode ?? item.barcode_number ?? ''}
                    onChange={(e) => setFieldDrafts(prev => ({ ...prev, [item.id]: { ...prev[item.id], barcode: e.target.value } }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de stencil</Label>
                  <Input
                    placeholder="ST-01"
                    value={fieldDrafts[item.id]?.stencil ?? item.stencil_number ?? ''}
                    onChange={(e) => setFieldDrafts(prev => ({ ...prev, [item.id]: { ...prev[item.id], stencil: e.target.value } }))}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => saveIdentifiers(item)} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-2" /> Guardar IDs
                </Button>
                <Button size="sm" variant="secondary" onClick={() => handleCopyUrl(item)}>
                  <Link2 className="h-4 w-4 mr-2" /> Copiar URL
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDownloadQr(item)}>
                  <Download className="h-4 w-4 mr-2" /> Descargar QR
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDownloadZpl(item)}>
                  <Download className="h-4 w-4 mr-2" /> ZPL
                </Button>
                <Button size="sm" variant="outline" onClick={() => handlePrintZebra(item)}>
                  <Printer className="h-4 w-4 mr-2" /> Imprimir Zebra
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};
