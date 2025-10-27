import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRoleGuard } from '@/hooks/useRoleGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ArrowDown, ArrowUp, RotateCcw } from 'lucide-react';

type PanelKey = 'overview' | 'crew' | 'docs' | 'logistics' | 'pending';

const PANEL_LABELS: Record<PanelKey, string> = {
  overview: 'Jobs Overview',
  crew: 'Crew Assignments',
  docs: 'Document Progress',
  logistics: 'Logistics',
  pending: 'Pending Actions',
};

const DEFAULT_ORDER: PanelKey[] = ['overview', 'crew', 'docs', 'logistics', 'pending'];

interface WallboardPresetRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  panel_order: string[];
  panel_durations: Record<string, number>;
  rotation_fallback_seconds: number;
  highlight_ttl_seconds: number;
  ticker_poll_interval_seconds: number;
  updated_at: string;
}

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
  return filtered.length ? filtered : [...DEFAULT_ORDER];
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  if (value < min) return min;
  if (value > max) return max;
  return Math.round(value);
}

export default function WallboardPresets() {
  useRoleGuard(['admin', 'management']);
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [presets, setPresets] = useState<WallboardPresetRow[]>([]);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);

  const activePreset = useMemo(
    () => presets.find((p) => p.slug === activeSlug) || null,
    [presets, activeSlug]
  );

  const [panelOrder, setPanelOrder] = useState<PanelKey[]>([...DEFAULT_ORDER]);
  const [panelDurations, setPanelDurations] = useState<Record<PanelKey, number>>({
    overview: 12,
    crew: 12,
    docs: 12,
    logistics: 12,
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
          'id, slug, name, description, panel_order, panel_durations, rotation_fallback_seconds, highlight_ttl_seconds, ticker_poll_interval_seconds, updated_at'
        )
        .order('slug', { ascending: true });
      if (error) {
        console.error('Failed to load wallboard presets', error);
        toast({
          title: 'Failed to load presets',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        const rows = (data || []) as WallboardPresetRow[];
        setPresets(rows);
        if (rows.length > 0) {
          setActiveSlug((current) => current ?? rows[0].slug);
        }
      }
      setLoading(false);
    };

    fetchPresets();
  }, [toast]);

  useEffect(() => {
    if (!activePreset) return;
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
    setSaving(true);
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
    };

    const { error } = await supabase
      .from('wallboard_presets')
      .update(payload)
      .eq('id', activePreset.id);

    if (error) {
      toast({
        title: 'Failed to save preset',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Preset saved' });
      const updatedAt = new Date().toISOString();
      setPresets((rows) =>
        rows.map((row) =>
          row.id === activePreset.id
            ? ({
                ...row,
                ...payload,
                updated_at: updatedAt,
              } as WallboardPresetRow)
            : row
        )
      );
    }
    setSaving(false);
  };

  const resetChanges = () => {
    if (!activePreset) return;
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Wallboard Presets</h1>
        <p className="text-muted-foreground">
          Configure rotation order and timing for the wallboard panels. Changes apply immediately for users referencing the
          selected preset.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-xl">Preset</CardTitle>
            <p className="text-sm text-muted-foreground">Select an existing preset to review or update.</p>
          </div>
          <div className="w-full md:w-64">
            <Select value={activeSlug ?? undefined} onValueChange={setActiveSlug} disabled={loading}>
              <SelectTrigger>
                <SelectValue placeholder={loading ? 'Loading…' : 'Choose preset'} />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.slug} value={preset.slug}>
                    {preset.name} ({preset.slug})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        {activePreset && (
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Panel Order</h2>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={resetChanges} disabled={saving}>
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button onClick={saveChanges} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
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
                          Remove
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-1 md:flex-row md:items-center">
                      <Label htmlFor={`${panel}-duration`} className="text-sm text-muted-foreground">
                        Duration (seconds)
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
                    No panels selected. Add a panel from the dropdown below.
                  </div>
                )}
              </div>

              {availablePanels.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-muted-foreground">Add panel:</span>
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
                <Label htmlFor="fallback-seconds">Fallback rotation (seconds)</Label>
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
                  Used when a panel is missing a duration or fallback timing is required.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="highlight-seconds">Highlight TTL (seconds)</Label>
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
                  Controls how long highlighted jobs remain emphasised.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticker-seconds">Ticker refresh (seconds)</Label>
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
                  How frequently the announcements ticker reloads messages.
                </p>
              </div>
            </div>
          </CardContent>
        )}
        {!activePreset && !loading && presets.length === 0 && (
          <CardContent>
            <p className="text-sm text-muted-foreground">No presets available yet.</p>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
