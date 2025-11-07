import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useMorningSummarySubscription } from '@/hooks/useMorningSummarySubscription';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { Bell, Info } from 'lucide-react';

type Department = {
  value: string;
  label: string;
  emoji: string;
};

const DEPARTMENTS: Department[] = [
  { value: 'sound', label: 'Sonido', emoji: '🎤' },
  { value: 'lights', label: 'Iluminación', emoji: '💡' },
  { value: 'video', label: 'Vídeo', emoji: '📹' },
  { value: 'logistics', label: 'Logística', emoji: '🚚' },
  { value: 'production', label: 'Producción', emoji: '🎬' },
];

export function MorningSummarySubscription() {
  const { userRole } = useOptimizedAuth();
  const { subscription, isLoading, upsertSubscription, isUpdating } = useMorningSummarySubscription();

  const [enabled, setEnabled] = useState(false);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

  // Check if user has access (management, admin, or house_tech)
  const hasAccess = userRole && ['admin', 'management', 'house_tech'].includes(userRole);

  // Sync with loaded subscription
  useEffect(() => {
    if (subscription) {
      setEnabled(subscription.enabled);
      setSelectedDepartments(subscription.subscribed_departments || []);
    }
  }, [subscription]);

  const handleSave = () => {
    upsertSubscription({
      enabled,
      subscribed_departments: selectedDepartments,
    });
  };

  const toggleDepartment = (deptValue: string) => {
    setSelectedDepartments(prev =>
      prev.includes(deptValue)
        ? prev.filter(d => d !== deptValue)
        : [...prev, deptValue]
    );
  };

  const selectAll = () => {
    setSelectedDepartments(DEPARTMENTS.map(d => d.value));
  };

  const deselectAll = () => {
    setSelectedDepartments([]);
  };

  // Don't show to unauthorized users
  if (!hasAccess) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Mi Suscripción al Resumen Diario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Cargando configuración...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Mi Suscripción al Resumen Diario
        </CardTitle>
        <CardDescription>
          Elige qué departamentos quieres recibir en tu resumen matutino automático
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="subscription-enabled" className="text-base">
            Recibir resumen diario
          </Label>
          <Switch
            id="subscription-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Department Selection */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Departamentos
            </Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={selectAll}
                disabled={!enabled}
                className="h-7 text-xs"
              >
                Todos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={deselectAll}
                disabled={!enabled}
                className="h-7 text-xs"
              >
                Ninguno
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {DEPARTMENTS.map(dept => (
              <div
                key={dept.value}
                className="flex items-center space-x-3 p-3 border rounded-md hover:bg-accent/50 transition-colors"
              >
                <Checkbox
                  id={`dept-${dept.value}`}
                  checked={selectedDepartments.includes(dept.value)}
                  onCheckedChange={() => toggleDepartment(dept.value)}
                  disabled={!enabled}
                />
                <Label
                  htmlFor={`dept-${dept.value}`}
                  className="flex items-center gap-2 text-sm font-normal cursor-pointer flex-1"
                >
                  <span className="text-lg">{dept.emoji}</span>
                  <span>{dept.label}</span>
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
            <p className="font-medium">¿Cómo funciona?</p>
            <p className="text-blue-700 dark:text-blue-300">
              Recibirás una notificación cada mañana con el estado del personal de los departamentos seleccionados:
              quién está en trabajos, en almacén, de vacaciones, etc.
            </p>
            {selectedDepartments.length > 1 && (
              <p className="text-blue-700 dark:text-blue-300 font-medium mt-2">
                Has seleccionado {selectedDepartments.length} departamentos. Recibirás un solo resumen con todos ellos.
              </p>
            )}
          </div>
        </div>

        {/* Warning if no departments selected */}
        {enabled && selectedDepartments.length === 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
            <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              Selecciona al menos un departamento para recibir el resumen.
            </p>
          </div>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isUpdating || (enabled && selectedDepartments.length === 0)}
          className="w-full"
        >
          {isUpdating ? 'Guardando...' : 'Guardar preferencias'}
        </Button>

        {/* Last Updated */}
        {subscription?.updated_at && (
          <p className="text-xs text-muted-foreground text-center">
            Última actualización: {new Date(subscription.updated_at).toLocaleString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
