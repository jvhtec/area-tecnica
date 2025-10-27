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

type PanelKey = 'overview' | 'crew' | 'docs' | 'logistics' | 'calendar' | 'pending';

const PANEL_LABELS: Record<PanelKey, string> = {
  overview: 'Jobs Overview',
  crew: 'Crew Assignments',
  docs: 'Document Progress',
  logistics: 'Logistics',
  calendar: 'Calendar',
  pending: 'Pending Actions',
};

const DEFAULT_ORDER: PanelKey[] = ['overview', 'crew', 'docs', 'logistics', 'calendar', 'pending'];

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
    docs: 12,
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
          title: 'Failed to load presets',
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
    setDisplayUrlInput(activePreset.display_url ?? '');
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
    const trimmedUrl = displayUrlInput.trim();

    if (!trimmedSlug) {
      toast({
        title: 'Slug required',
        description: 'Provide a unique slug for this wallboard preset.',
        variant: 'destructive',
      });
      return;
    }

    if (!trimmedUrl) {
      toast({
        title: 'URL required',
        description: 'Add a display URL so the wallboard can be shared.',
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
          title: 'Failed to save preset',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'Preset saved' });
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
        title: 'Failed to save preset',
        description: 'Unexpected error while saving the preset.',
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
    setDisplayUrlInput(activePreset.display_url ?? '');
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
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(value);
      toast({ title: 'Copied', description: 'URL copied to clipboard.' });
    } catch (error) {
      console.error('Failed to copy wallboard URL', error);
      toast({
        title: 'Copy failed',
        description: 'Unable to copy this URL automatically.',
        variant: 'destructive',
      });
    }
  };

  const createPreset = async () => {
    const name = newPresetName.trim();
    const slug = newPresetSlug.trim();
    const url = newPresetUrl.trim();

    if (!name || !slug || !url) {
      toast({
        title: 'Missing details',
        description: 'Name, slug, and URL are required to create a wallboard.',
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
          title: 'Creation failed',
          description: error.message,
          variant: 'destructive',
        });
      } else if (data) {
        const row = data as WallboardPresetRow;
        toast({ title: 'Wallboard created', description: `${row.name} is ready to configure.` });
        setPresets((rows) => sortBySlug([...rows, row]));
        setActiveSlug(row.slug);
        setNewPresetName('');
        setNewPresetSlug('');
        setNewPresetUrl('');
      }
    } catch (error) {
      console.error('Unexpected error creating wallboard preset', error);
      toast({
        title: 'Creation failed',
        description: 'Unexpected error while creating the wallboard.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const deletePreset = async (preset: WallboardPresetRow) => {
    if (typeof window !== 'undefined') {
      const confirmed = window.confirm(
        `Delete wallboard "${preset.name}"? This action cannot be undone and any displays using it will stop updating.`
      );
      if (!confirmed) return;
    }

    setDeletingId(preset.id);
    try {
      const { error } = await supabase.from('wallboard_presets').delete().eq('id', preset.id);

      if (error) {
        console.error('Failed to delete wallboard preset', error);
        toast({
          title: 'Delete failed',
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
        toast({ title: 'Wallboard deleted', description: `${preset.name} has been removed.` });
      }
    } catch (error) {
      console.error('Unexpected error deleting wallboard preset', error);
      toast({
        title: 'Delete failed',
        description: 'Unexpected error while deleting the wallboard.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

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
        <CardHeader>
          <div>
            <CardTitle className="text-xl">Wallboards</CardTitle>
            <p className="text-sm text-muted-foreground">
              Manage preset slugs and display URLs for every wallboard screen.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            {presets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No wallboards configured yet.</p>
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
                      <Input readOnly value={preset.display_url} className="flex-1" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyDisplayUrl(preset.display_url)}
                        disabled={!preset.display_url}
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copy URL
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
                        Edit preset
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => deletePreset(preset)}
                        disabled={deletingId === preset.id || saving || creating}
                      >
                        {deletingId === preset.id ? (
                          'Deleting…'
                        ) : (
                          <span className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4" /> Delete
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
              <Plus className="h-4 w-4" /> Add new wallboard
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-wallboard-name">Name</Label>
                <Input
                  id="new-wallboard-name"
                  value={newPresetName}
                  onChange={(event) => setNewPresetName(event.target.value)}
                  placeholder="Production Floor"
                  disabled={creating}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-wallboard-slug">Slug</Label>
                <Input
                  id="new-wallboard-slug"
                  value={newPresetSlug}
                  onChange={(event) => setNewPresetSlug(event.target.value)}
                  placeholder="production-floor"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">Used to reference the preset in URLs.</p>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="new-wallboard-url">Display URL</Label>
                <Input
                  id="new-wallboard-url"
                  value={newPresetUrl}
                  onChange={(event) => setNewPresetUrl(event.target.value)}
                  placeholder="https://example.com/wallboard/production-floor"
                  disabled={creating}
                />
                <p className="text-xs text-muted-foreground">Send this link to the device showing the wallboard.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={createPreset} disabled={creating}>
                {creating ? 'Creating…' : 'Create wallboard'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

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
                <Label htmlFor="preset-slug">Preset slug</Label>
                <Input
                  id="preset-slug"
                  value={slugInput}
                  onChange={(event) => setSlugInput(event.target.value)}
                  placeholder="production-floor"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">Must be unique and will update the wallboard route.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="preset-display-url">Display URL</Label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Input
                    id="preset-display-url"
                    value={displayUrlInput}
                    onChange={(event) => setDisplayUrlInput(event.target.value)}
                    placeholder="https://example.com/wallboard/production-floor"
                    disabled={saving}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => copyDisplayUrl(displayUrlInput)}
                    disabled={!displayUrlInput}
                  >
                    <Copy className="mr-2 h-4 w-4" /> Copy
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this link with any device that should display the wallboard.
                </p>
              </div>
            </div>
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
