import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { usePushNotificationSchedule } from '@/hooks/usePushNotificationSchedule';
import { Clock, Calendar, Info } from 'lucide-react';

export function PushNotificationSchedule() {
  const { schedule, isLoading, updateSchedule, isUpdating } = usePushNotificationSchedule('daily.morning.summary');

  const [enabled, setEnabled] = useState(false);
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  // Sync with loaded schedule
  useEffect(() => {
    if (schedule) {
      setEnabled(schedule.enabled);
      // Convert HH:MM:SS to HH:MM
      setScheduleTime(schedule.schedule_time.substring(0, 5));
      setDaysOfWeek(schedule.days_of_week || [1, 2, 3, 4, 5]);
    }
  }, [schedule]);

  const handleSave = () => {
    updateSchedule({
      enabled,
      schedule_time: `${scheduleTime}:00`,
      days_of_week: daysOfWeek,
    });
  };

  const toggleDay = (day: number) => {
    setDaysOfWeek(prev =>
      prev.includes(day)
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const weekDays = [
    { value: 1, label: 'Lun' },
    { value: 2, label: 'Mar' },
    { value: 3, label: 'Mié' },
    { value: 4, label: 'Jue' },
    { value: 5, label: 'Vie' },
    { value: 6, label: 'Sáb' },
    { value: 7, label: 'Dom' },
  ];

  const timeOptions = Array.from({ length: 7 }, (_, i) => {
    const hour = i + 6; // 6 AM to 12 PM
    return {
      value: `${hour.toString().padStart(2, '0')}:00`,
      label: `${hour}:00`,
    };
  });

  // Calculate next send time
  const getNextSendTime = () => {
    if (!enabled || daysOfWeek.length === 0) return null;

    const now = new Date();
    const [hour, minute] = scheduleTime.split(':').map(Number);

    // Find next occurrence
    for (let i = 0; i < 8; i++) {
      const checkDate = new Date(now);
      checkDate.setDate(checkDate.getDate() + i);
      checkDate.setHours(hour, minute, 0, 0);

      // Monday = 1, Sunday = 7, but JS Date uses Sunday = 0
      const dayNum = checkDate.getDay() === 0 ? 7 : checkDate.getDay();

      if (daysOfWeek.includes(dayNum) && checkDate > now) {
        return checkDate.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    }

    return null;
  };

  const nextSendTime = getNextSendTime();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Notificación Diaria Matutina
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
          <Clock className="h-5 w-5" />
          Notificación Diaria Matutina
        </CardTitle>
        <CardDescription>
          Envía un resumen automático cada mañana con el estado del personal del día (trabajos, almacén, vacaciones, etc.)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="schedule-enabled" className="text-base">
            Activar notificación diaria
          </Label>
          <Switch
            id="schedule-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Time Selector */}
        <div className="space-y-2">
          <Label htmlFor="schedule-time" className="text-sm font-medium">
            Hora de envío
          </Label>
          <Select value={scheduleTime} onValueChange={setScheduleTime} disabled={!enabled}>
            <SelectTrigger id="schedule-time" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Hora de España (Europe/Madrid, UTC+1/+2)
          </p>
        </div>

        {/* Days of Week Selector */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Días de la semana
          </Label>
          <div className="flex flex-wrap gap-2">
            {weekDays.map(day => (
              <div key={day.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`day-${day.value}`}
                  checked={daysOfWeek.includes(day.value)}
                  onCheckedChange={() => toggleDay(day.value)}
                  disabled={!enabled}
                />
                <Label
                  htmlFor={`day-${day.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {day.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Next Send Time Info */}
        {enabled && nextSendTime && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-blue-900 dark:text-blue-100">
                Próximo envío programado:
              </p>
              <p className="text-blue-700 dark:text-blue-300 capitalize">
                {nextSendTime}
              </p>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
          <Info className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted-foreground space-y-1">
            <p>
              Los destinatarios se configuran en la <strong>Matriz de Notificaciones Push</strong> más arriba.
            </p>
            <p>
              Cada usuario recibirá un resumen personalizado con datos de su departamento.
            </p>
          </div>
        </div>

        {/* Last Sent Info */}
        {schedule?.last_sent_at && (
          <p className="text-xs text-muted-foreground">
            Último envío: {new Date(schedule.last_sent_at).toLocaleString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        )}

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isUpdating || !enabled && !schedule?.enabled}
          className="w-full"
        >
          {isUpdating ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </CardContent>
    </Card>
  );
}
