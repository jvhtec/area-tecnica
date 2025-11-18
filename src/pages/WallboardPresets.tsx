import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowDown, ArrowUp, Copy, Plus, RotateCcw, Trash2 } from 'lucide-react';

const DEFAULT_WALLBOARD_TOKEN = 'f3c98b2df1a4e7650fbd44c9ce19ab73c6d7a0e49b3f25ea18fd6740a2ce9b1d';

type PanelKey = 'overview' | 'crew' | 'logistics' | 'calendar' | 'pending';

const PANEL_LABELS: Record<PanelKey, string> = {
  overview: 'Resumen de Trabajos',
  crew: 'Asignaciones de Equipo',
  logistics: 'Logística',
  calendar: 'Calendario',
  pending: 'Acciones Pendientes',
};

const DEFAULT_ORDER: PanelKey[] = ['overview', 'crew', 'logistics', 'calendar', 'pending'];

interface WallboardPresetRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  display_url: string;
  panel_order: string[];
  panel_durations: Record<string, number>;
  rotation_fallback_seconds: number;
  highlight_ttl_seconds: number;
  ticker_poll_interval_seconds: number;
  created_at: string;
  updated_at: string;
}

const sortBySlug = (list: WallboardPresetRow[]) =>
  [...list].sort((a, b) => a.slug.localeCompare(b.slug));

function normaliseOrder(order?: string[] | null): PanelKey[] {
  const seen = new Set<string>();
  const filtered: PanelKey[] = [];
  (order ?? []).forEach((raw) => {
    const key = raw as PanelKey;
    if ((key in PANEL_LABELS) && !seen.has(key)) {
      filtered.push(key);
      seen.add(key);
    }
  });
  if (filtered.length === 0) {
    return [...DEFAULT_ORDER];
  }
  return filtered;
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return Math.round(value);
}

function getPublicDisplayUrl(_value: string, slug?: string): string {
  const origin = (typeof window !== 'undefined' && window.location?.origin) ? window.location.origin : '';
  const token = (import.meta as any).env?.VITE_WALLBOARD_TOKEN as string | undefined || DEFAULT_WALLBOARD_TOKEN;
  const cleanSlug = (slug?.trim() || 'default').toLowerCase();
  return `${origin || ''}/wallboard/public/${encodeURIComponent(token)}/${encodeURIComponent(cleanSlug)}`;
}

export default function WallboardPresets() {
  useRoleGuard(['admin', 'management']);
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [presets, setPresets] = useState<WallboardPresetRow[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isSavingRef = useRef(false);

  const activePreset = useMemo(
    () => presets.find((p) => p.slug === activeSlug) || null,
    [presets, activeSlug]
  );

  const [slugInput, setSlugInput] = useState('');
  const [displayUrlInput, setDisplayUrlInput] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetSlug, setNewPresetSlug] = useState('');
  const [newPresetUrl, setNewPresetUrl] = useState('');

  const [panelOrder, setPanelOrder] = useState<PanelKey[]>([...DEFAULT_ORDER]);
  const [panelDurations, setPanelDurations] = useState<Record<PanelKey, number>>({
    overview: 12,
    crew: 12,
    logistics: 12,
    calendar: 12,
    pending: 12,
  });
  const [fallbackSeconds, setFallbackSeconds] = useState(12);
  const [highlightSeconds, setHighlightSeconds] = useState(300);
  const [tickerSeconds, setTickerSeconds] = useState(20);

  useEffect(() => {
    const fetchPresets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallboard_presets')
        .select(
          'id, slug, name, description, display_url, panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds, created_at, updated_at'
        )
        .order('slug', { ascending: true });
      if (error) {
        console.error('Failed to load wallboard presets', error);
        toast({
          title: 'Error al cargar configuraciones',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        const rows = (data || []) as WallboardPresetRow[];
        setPresets(sortBySlug(rows));
        if (rows.length > 0) {
          setActiveSlug((current) => current ?? rows[0].slug);
        }
      }
      setLoading(false);
    };

    fetchPresets();
  }, [toast]);

  useEffect(() => {
    if (!activePreset || isSavingRef.current) return;
    setSlugInput(activePreset.slug);
    setDisplayUrlInput(getPublicDisplayUrl('', activePreset.slug));
    setPanelOrder(normaliseOrder(activePreset.panel_order));
    setPanelDurations((prev) => {
      const next: Record<PanelKey, number> = { ...prev };
      (Object.keys(PANEL_LABELS) as PanelKey[]).forEach((key) => {
        const raw = (activePreset.panel_durations || {})[key];
        next[key] = clampNumber(Number(raw ?? activePreset.rotation_fallback_seconds ?? 12), 1, 600, 12);
      });
      return next;
    });
    setFallbackSeconds(clampNumber(activePreset.rotation_fallback_seconds ?? 12, 1, 600, 12));
    setHighlightSeconds(clampNumber(activePreset.highlight_ttl_seconds ?? 300, 30, 3600, 300));
    setTickerSeconds(clampNumber(activePreset.ticker_poll_interval_seconds ?? 20, 10, 600, 20));
  }, [activePreset]);

  const movePanel = (index: number, direction: -1 | 1) => {
    setPanelOrder((order) => {
      const next = [...order];
      const target = index + direction;
      if (target < 0 || target >= next.length) return order;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removePanel = (panel: PanelKey) => {
    setPanelOrder((order) => order.filter((p) => p !== panel));
  };

  const addPanel = (panel: PanelKey) => {
    setPanelOrder((order) => (order.includes(panel) ? order : [...order, panel]));
  };

  const updateDuration = (panel: PanelKey, value: string) => {
    const numeric = clampNumber(Number(value), 1, 600, fallbackSeconds ?? 12);
    setPanelDurations((durations) => ({ ...durations, [panel]: numeric }));
  };

  const saveChanges = async () => {
    if (!activePreset) return;
    const trimmedSlug = slugInput.trim();
    const trimmedUrl = getPublicDisplayUrl('', trimmedSlug);

    if (!trimmedSlug) {
      toast({
        title: 'Se requiere slug',
        description: 'Proporcione un slug único para esta configuración de wallboard.',
        variant: 'destructive',
      });
      return;
    }

    if (!trimmedUrl) {
      toast({
        title: 'Se requiere URL',
        description: 'Agregue una URL de visualización para que el wallboard pueda compartirse (verifique VITE_WALLBOARD_TOKEN).',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    isSavingRef.current = true;
    const nextOrder = panelOrder.length ? panelOrder : [...DEFAULT_ORDER];
    const payload = {
      panel_order: nextOrder,
      panel_durations: (Object.keys(PANEL_LABELS) as PanelKey[]).reduce<Record<string, number>>((acc, key) => {
        acc[key] = clampNumber(panelDurations[key] ?? fallbackSeconds ?? 12, 1, 600, 12);
        return acc;
      }, {}),
      rotation_fallback_seconds: clampNumber(fallbackSeconds, 1, 600, 12),
      highlight_ttl_seconds: clampNumber(highlightSeconds, 30, 3600, 300),
      ticker_poll_interval_seconds: clampNumber(tickerSeconds, 10, 600, 20),
      slug: trimmedSlug,
      display_url: trimmedUrl,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('wallboard_presets')
        .update(payload)
        .eq('id', activePreset.id);

      if (error) {
        toast({
          title: 'Error al guardar configuración',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Configuración guardada' });
        const updatedAt = new Date().toISOString();
        setSlugInput(trimmedSlug);
        setDisplayUrlInput(trimmedUrl);
        setActiveSlug(trimmedSlug);
        setPresets((rows) =>
          sortBySlug(
            rows.map((row) =>
              row.id === activePreset.id
                ? ({
                    ...row,
                    ...payload,
                    updated_at: updatedAt,
                  } as WallboardPresetRow)
                : row
            )
          )
        );
      }
    } catch (error) {
      console.error('Unexpected error saving wallboard preset', error);
      toast({
        title: 'Error al guardar configuración',
        description: 'Error inesperado al guardar la configuración.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const resetChanges = () => {
    if (!activePreset) return;
    setSlugInput(activePreset.slug);
    setDisplayUrlInput(getPublicDisplayUrl('', activePreset.slug));
    setPanelOrder(normaliseOrder(activePreset.panel_order));
    setPanelDurations((durations) => {
      const next = { ...durations };
      (Object.keys(PANEL_LABELS) as PanelKey[]).forEach((key) => {
        const raw = (activePreset.panel_durations || {})[key];
        next[key] = clampNumber(Number(raw ?? activePreset.rotation_fallback_seconds ?? 12), 1, 600, 12);
      });
      return next;
    });
    setFallbackSeconds(clampNumber(activePreset.rotation_fallback_seconds ?? 12, 1, 600, 12));
    setHighlightSeconds(clampNumber(activePreset.highlight_ttl_seconds ?? 300, 30, 3600, 300));
    setTickerSeconds(clampNumber(activePreset.ticker_poll_interval_seconds ?? 20, 10, 600, 20));
  };

  const availablePanels = (Object.keys(PANEL_LABELS) as PanelKey[]).filter((key) => !panelOrder.includes(key));

  const copyDisplayUrl = async (value: string) => {
    if (!value) return;
    const publicUrl = getPublicDisplayUrl('', slugInput || activeSlug || 'default');
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(publicUrl);
      toast({ title: 'Copiado', description: 'URL copiada al portapapeles.' });
    } catch (error) {
      console.error('Failed to copy wallboard URL', error);
      toast({
        title: 'Error al copiar',
        description: 'No se pudo copiar esta URL automáticamente.',
        variant: 'destructive',
      });
    }
  };

  const createPreset = async () => {
    const name = newPresetName.trim();
    const slug = newPresetSlug.trim();
    const url = getPublicDisplayUrl('', slug);

    if (!name || !slug || !url) {
      toast({
        title: 'Faltan detalles',
        description: 'Se requieren nombre, slug y URL para crear un wallboard (verifique VITE_WALLBOARD_TOKEN).',
        variant: 'destructive',
      });
      return;
    }

    setCreating(true);
    const payload = {
      name,
      slug,
      description: null,
      display_url: url,
      panel_order: [...DEFAULT_ORDER],
      panel_durations: (Object.keys(PANEL_LABELS) as PanelKey[]).reduce<Record<string, number>>((acc, key) => {
        acc[key] = 12;
        return acc;
      }, {}),
      rotation_fallback_seconds: 12,
      highlight_ttl_seconds: 300,
      ticker_poll_interval_seconds: 20,
    };

    try {
      const { data, error } = await supabase
        .from('wallboard_presets')
        .insert(payload)
        .select(
          'id, slug, name, description, display_url, panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds, created_at, updated_at'
        )
        .single();

      if (error) {
        console.error('Failed to create wallboard preset', error);
        toast({
          title: 'Error al crear',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        const row = data as WallboardPresetRow;
        toast({ title: 'Wallboard creado', description: `${row.name} está listo para configurar.` });
        setPresets((rows) => sortBySlug([...rows, row]));
        setActiveSlug(row.slug);
        setNewPresetName('');
        setNewPresetSlug('');
        setNewPresetUrl('');
      }
    } catch (error) {
      console.error('Unexpected error creating wallboard preset', error);
      toast({
        title: 'Error al crear',
        description: 'Error inesperado al crear el wallboard.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const deletePreset = async (preset: WallboardPresetRow) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `¿Eliminar wallboard "${preset.name}"? Esta acción no se puede deshacer y cualquier pantalla que lo use dejará de actualizarse.`
      );
      if (!confirmed) return;
    }

    setDeletingId(preset.id);
    try {
      const { error } = await supabase.from('wallboard_presets').delete().eq('id', preset.id);

      if (error) {
        console.error('Failed to delete wallboard preset', error);
        toast({
          title: 'Error al eliminar',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        const remaining = sortBySlug(presets.filter((row) => row.id !== preset.id));
        setPresets(remaining);
        setActiveSlug((current) => {
          if (current === preset.slug) {
            return remaining.length > 0 ? remaining[0].slug : null;
          }
          return current;
        });
        toast({ title: 'Wallboard eliminado', description: `${preset.name} ha sido eliminado.` });
      }
    } catch (error) {
      console.error('Unexpected error deleting wallboard preset', error);
      toast({
        title: 'Error al eliminar',
        description: 'Error inesperado al eliminar el wallboard.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Configuraciones de Wallboard</h1>
        <p className="text-muted-foreground">
          Configure el orden de rotación y el tiempo para los paneles del wallboard. Los cambios se aplican inmediatamente para los usuarios que referencian la
          configuración seleccionada.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="text-xl">Wallboards</CardTitle>
            <p className="text-sm text-muted-foreground">
              Administre los slugs de configuración y las URLs de visualización para cada pantalla de wallboard.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay wallboards configurados aún.</p>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-muted-foreground">Slug: {preset.slug}</div>
                  </div>
                  <div className="flex flex-col gap-2 md:w-[28rem]">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input readOnly value={getPublicDisplayUrl(preset.display_url, preset.slug)} className="flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyDisplayUrl(preset.display_url)}
                        disabled={!preset.display_url}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copiar URL
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setActiveSlug(preset.slug)}
                        disabled={activeSlug === preset.slug || saving}
                      >
                        Editar configuración
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => deletePreset(preset)}
                        disabled={deletingId === preset.id || saving || creating}
                      >
                        {deletingId === preset.id ? (
                          'Eliminando…'
                        ) : (
                          <span className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> Eliminar
                          </span>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4 rounded-md border border-dashed p-4">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Plus className="h-4 w-4" /> Agregar nuevo wallboard
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-wallboard-name">Nombre</Label>
                <Input
                  id="new-wallboard-name"
                  value={newPresetName}
                  onChange={(event) => setNewPresetName(event.target.value)}
                  placeholder="Piso de Producción"
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-wallboard-slug">Slug</Label>
                <Input
                  id="new-wallboard-slug"
                  value={newPresetSlug}
                  onChange={(event) => setNewPresetSlug(event.target.value)}
                  placeholder="piso-produccion"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">Se usa para referenciar la configuración en las URLs.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-wallboard-url">URL de Visualización</Label>
                <Input
                  id="new-wallboard-url"
                  value={newPresetUrl}
                  onChange={(event) => setNewPresetUrl(event.target.value)}
                  placeholder="https://ejemplo.com/wallboard/piso-produccion"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">Envíe este enlace al dispositivo que muestra el wallboard.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={createPreset} disabled={creating}>
                {creating ? 'Creando…' : 'Crear wallboard'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-xl">Configuración</CardTitle>
            <p className="text-sm text-muted-foreground">Seleccione una configuración existente para revisar o actualizar.</p>
          </div>
          <div className="w-full md:w-64">
            <Select value={activeSlug ?? undefined} onValueChange={setActiveSlug} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Cargando…' : 'Elegir configuración'} />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.slug}>
                    {preset.name} ({preset.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        {activePreset && (
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="preset-slug">Slug de configuración</Label>
                <Input
                  id="preset-slug"
                  value={slugInput}
                  onChange={(event) => setSlugInput(event.target.value)}
                  placeholder="piso-produccion"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Debe ser único y actualizará la ruta del wallboard.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-display-url">URL de Visualización</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="preset-display-url"
                    value={getPublicDisplayUrl('', activeSlug || slugInput)}
                    readOnly
                    placeholder="https://ejemplo.com/wallboard/public/TOKEN/slug"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyDisplayUrl(getPublicDisplayUrl('', slugInput || activeSlug || 'default'))}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copiar
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  URL pública resultante:{' '}
                  <span className="font-mono break-all">
                    {getPublicDisplayUrl('', slugInput)}
                  </span>
                  . Comparta este enlace con cualquier dispositivo que deba mostrar el wallboard.
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Orden de Paneles</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetChanges} disabled={saving}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Restablecer
                  </Button>
                  <Button onClick={saveChanges} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar Cambios'}
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {panelOrder.map((panel, index) => (
                  <div
                    key={panel}
                    className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{PANEL_LABELS[panel]}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => movePanel(index, -1)}
                          disabled={index === 0 || saving}
                          aria-label={`Move ${PANEL_LABELS[panel]} up`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => movePanel(index, 1)}
                          disabled={index === panelOrder.length - 1 || saving}
                          aria-label={`Move ${PANEL_LABELS[panel]} down`}
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removePanel(panel)}
                          disabled={panelOrder.length <= 1 || saving}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1 md:flex-row md:items-center">
                      <Label htmlFor={`${panel}-duration`} className="text-sm text-muted-foreground">
                        Duración (segundos)
                      </Label>
                      <Input
                        id={`${panel}-duration`}
                        type="number"
                        min={1}
                        max={600}
                        value={panelDurations[panel] ?? fallbackSeconds}
                        onChange={(event) => updateDuration(panel, event.target.value)}
                        className="w-28"
                        disabled={saving}
                      />
                    </div>
                  </div>
                ))}
                {panelOrder.length === 0 && (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    No hay paneles seleccionados. Agregue un panel desde el menú desplegable a continuación.
                  </div>
                )}
              </div>

              {availablePanels.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Agregar panel:</span>
                  {availablePanels.map((panel) => (
                    <Button
                      key={panel}
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => addPanel(panel)}
                      disabled={saving}
                    >
                      {PANEL_LABELS[panel]}
                    </Button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="fallback-seconds">Rotación de respaldo (segundos)</Label>
                <Input
                  id="fallback-seconds"
                  type="number"
                  min={1}
                  max={600}
                  value={fallbackSeconds}
                  onChange={(event) => setFallbackSeconds(clampNumber(Number(event.target.value), 1, 600, 12))}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Se usa cuando un panel no tiene una duración o se requiere tiempo de respaldo.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="highlight-seconds">TTL de resaltado (segundos)</Label>
                <Input
                  id="highlight-seconds"
                  type="number"
                  min={30}
                  max={3600}
                  value={highlightSeconds}
                  onChange={(event) => setHighlightSeconds(clampNumber(Number(event.target.value), 30, 3600, 300))}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Controla cuánto tiempo permanecen resaltados los trabajos.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticker-seconds">Actualización del ticker (segundos)</Label>
                <Input
                  id="ticker-seconds"
                  type="number"
                  min={10}
                  max={600}
                  value={tickerSeconds}
                  onChange={(event) => setTickerSeconds(clampNumber(Number(event.target.value), 10, 600, 20))}
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  Con qué frecuencia el ticker de anuncios recarga los mensajes.
                </p>
              </div>
            </div>
          </CardContent>
        )}
        {!activePreset && !loading && presets.length === 0 && (
          <CardContent>
            <p className="text-sm text-muted-foreground">No hay configuraciones disponibles aún.</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
