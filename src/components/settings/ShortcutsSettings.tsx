/**
 * ShortcutsSettings
 *
 * Settings panel for managing keyboard shortcuts and Stream Deck integration.
 * Allows users to:
 * - View all available shortcuts
 * - Filter by category
 * - Search shortcuts
 * - Edit keybindings
 * - Enable/disable shortcuts
 * - Export/import configurations
 * - Monitor Stream Deck connection status
 */

import React, { useState, useMemo } from 'react';
import { useShortcutStore, ShortcutCategory } from '@/stores/useShortcutStore';
import { getStreamDeckClient } from '@/lib/streamdeck/websocket-server';
import { ShortcutKeybindEditor } from './ShortcutKeybindEditor';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Download,
  Upload,
  RefreshCw,
  Wifi,
  WifiOff,
  Search,
  Keyboard,
  Navigation,
  Briefcase,
  Grid,
  Zap
} from 'lucide-react';
import { toast } from 'sonner';

const CATEGORY_ICONS: Record<ShortcutCategory, React.ReactNode> = {
  navigation: <Navigation className="h-4 w-4" />,
  'job-card': <Briefcase className="h-4 w-4" />,
  matrix: <Grid className="h-4 w-4" />,
  global: <Zap className="h-4 w-4" />,
};

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navegación',
  'job-card': 'Acciones de Trabajo',
  matrix: 'Matriz',
  global: 'Global',
};

export function ShortcutsSettings() {
  const {
    getAllShortcuts,
    getShortcutsByCategory,
    updateKeybind,
    enableShortcut,
    disableShortcut,
    exportConfig,
    importConfig,
  } = useShortcutStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'all'>('all');
  const [streamDeckConnected, setStreamDeckConnected] = useState(false);

  // Check Stream Deck connection status
  React.useEffect(() => {
    const client = getStreamDeckClient();
    setStreamDeckConnected(client.getConnectionStatus());

    const interval = setInterval(() => {
      setStreamDeckConnected(client.getConnectionStatus());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Get shortcuts based on filters
  const shortcuts = useMemo(() => {
    let result = selectedCategory === 'all'
      ? getAllShortcuts()
      : getShortcutsByCategory(selectedCategory);

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query) ||
          s.id.toLowerCase().includes(query)
      );
    }

    return result.sort((a, b) => a.label.localeCompare(b.label));
  }, [searchQuery, selectedCategory, getAllShortcuts, getShortcutsByCategory]);

  const handleExportConfig = () => {
    const config = exportConfig();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shortcuts-config.json';
    a.click();
    URL.revokeObjectURL(url);

    toast.success('Configuración exportada', {
      description: 'Archivo descargado: shortcuts-config.json',
    });
  };

  const handleImportConfig = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const config = JSON.parse(text);
        importConfig(config);

        toast.success('Configuración importada', {
          description: 'Los atajos han sido actualizados',
        });
      } catch (error) {
        toast.error('Error al importar', {
          description: 'El archivo no es válido',
        });
      }
    };
    input.click();
  };

  const handleReconnectStreamDeck = () => {
    const client = getStreamDeckClient();
    client.connect();
    toast.info('Reconectando...', {
      description: 'Intentando conectar con Stream Deck',
    });
  };

  const categoryCount = useMemo(() => {
    const counts: Record<ShortcutCategory | 'all', number> = {
      all: getAllShortcuts().length,
      navigation: getShortcutsByCategory('navigation').length,
      'job-card': getShortcutsByCategory('job-card').length,
      matrix: getShortcutsByCategory('matrix').length,
      global: getShortcutsByCategory('global').length,
    };
    return counts;
  }, [getAllShortcuts, getShortcutsByCategory]);

  return (
    <div className="space-y-6">
      {/* Stream Deck Status */}
      <Alert variant={streamDeckConnected ? 'default' : 'destructive'}>
        <div className="flex items-center gap-2">
          {streamDeckConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
          <AlertTitle>
            Stream Deck: {streamDeckConnected ? 'Conectado' : 'Desconectado'}
          </AlertTitle>
        </div>
        <AlertDescription>
          {streamDeckConnected ? (
            'El WebSocket está activo. Los botones del Stream Deck funcionarán correctamente.'
          ) : (
            <div className="flex flex-col gap-2">
              <span>
                No se pudo conectar a ws://localhost:3001. Asegúrate de que el servidor WebSocket está ejecutándose.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleReconnectStreamDeck}
                className="w-fit"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconectar
              </Button>
            </div>
          )}
        </AlertDescription>
      </Alert>

      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="text-sm text-muted-foreground">
          <Keyboard className="inline h-4 w-4 mr-1" />
          Gestiona los atajos de teclado y botones de Stream Deck
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportConfig}>
            <Download className="h-3 w-3 mr-1" />
            Exportar
          </Button>
          <Button size="sm" variant="outline" onClick={handleImportConfig}>
            <Upload className="h-3 w-3 mr-1" />
            Importar
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Buscar atajos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as ShortcutCategory | 'all')}>
          <TabsList className="w-full grid grid-cols-5 gap-1">
            <TabsTrigger value="all" className="text-xs">
              Todos ({categoryCount.all})
            </TabsTrigger>
            <TabsTrigger value="navigation" className="text-xs">
              <Navigation className="h-3 w-3 mr-1" />
              ({categoryCount.navigation})
            </TabsTrigger>
            <TabsTrigger value="job-card" className="text-xs">
              <Briefcase className="h-3 w-3 mr-1" />
              ({categoryCount['job-card']})
            </TabsTrigger>
            <TabsTrigger value="matrix" className="text-xs">
              <Grid className="h-3 w-3 mr-1" />
              ({categoryCount.matrix})
            </TabsTrigger>
            <TabsTrigger value="global" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              ({categoryCount.global})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Shortcuts List */}
      <div className="space-y-2">
        {shortcuts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No se encontraron atajos
          </div>
        ) : (
          shortcuts.map((shortcut) => (
            <div
              key={shortcut.id}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="mt-1">
                  {CATEGORY_ICONS[shortcut.category]}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{shortcut.label}</h4>
                    <Badge variant="outline" className="text-xs">
                      {CATEGORY_LABELS[shortcut.category]}
                    </Badge>
                    {shortcut.requiresSelection && (
                      <Badge variant="secondary" className="text-xs">
                        Requiere selección
                      </Badge>
                    )}
                  </div>
                  {shortcut.description && (
                    <p className="text-xs text-muted-foreground mb-3">
                      {shortcut.description}
                    </p>
                  )}

                  {/* Keybind Editor */}
                  <ShortcutKeybindEditor
                    currentKeybind={shortcut.customKeybind || shortcut.defaultKeybind}
                    onSave={(keybind) => updateKeybind(shortcut.id, keybind)}
                  />
                </div>

                {/* Enable/Disable Switch */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground">
                    {shortcut.enabled ? 'Activo' : 'Inactivo'}
                  </label>
                  <Switch
                    checked={shortcut.enabled}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        enableShortcut(shortcut.id);
                      } else {
                        disableShortcut(shortcut.id);
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="text-xs text-muted-foreground text-center pt-4 border-t">
        Mostrando {shortcuts.length} de {categoryCount.all} atajos totales
      </div>
    </div>
  );
}
