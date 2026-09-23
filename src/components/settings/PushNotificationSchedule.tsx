import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { usePushNotificationSchedule } from '@/hooks/usePushNotificationSchedule';
import { Clock, Calendar, Info } from 'lucide-react';
import type { ReactNode } from 'react';

type ScheduleCardConfig = {
  eventType: string;
  title: string;
  description: string;
  toggleLabel: string;
  /** Selectable send hours, inclusive; must match the DB valid_schedule_time window. */
  firstHour: number;
  lastHour: number;
  info: ReactNode;
};

const MORNING_SUMMARY: ScheduleCardConfig = {
  eventType: 'daily.morning.summary',
  title: 'Notificación Diaria Matutina',
  description: 'Envía un resumen automático cada mañana con el estado del personal del día (trabajos, almacén, vacaciones, etc.)',
  toggleLabel: 'Activar notificación diaria',
  firstHour: 6,
  lastHour: 12,
  info: (
    <>
      <p>
        Los usuarios (management, admin, house tech) pueden suscribirse individualmente en la sección <strong>"Mi Suscripción al Resumen Diario"</strong> más abajo.
      </p>
      <p>
        Cada usuario elige qué departamentos quiere recibir y puede ver múltiples departamentos en un solo resumen.
      </p>
    </>
  ),
};

const SHIFT_REMINDER: ScheduleCardConfig = {
  eventType: 'job.shift.reminder',
  title: 'Recordatorio de turno',
  description: 'La tarde anterior, cada técnico con parte de horas para el día siguiente recibe su trabajo, hora de citación y lugar.',
  toggleLabel: 'Activar recordatorio de turno',
  firstHour: 17,
  lastHour: 23,
  info: (
    <>
      <p>
        Los días seleccionados son los días de <strong>envío</strong>: marcar el domingo recuerda los turnos del lunes.
      </p>
      <p>
        Cada técnico puede desactivarlo desactivando la categoría <strong>"Trabajos"</strong> en sus preferencias de notificación.
      </p>
    </>
  ),
};

/** Evening-before reminder of tomorrow's job, call time and venue (job.shift.reminder). */
export function ShiftReminderSchedule() {
  return <PushNotificationSchedule config={SHIFT_REMINDER} />;
}

export function PushNotificationSchedule({ config = MORNING_SUMMARY }: { config?: ScheduleCardConfig }) {
  const { schedule, isLoading, updateSchedule, isUpdating } = usePushNotificationSchedule(config.eventType);

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

  const timeOptions = Array.from({ length: config.lastHour - config.firstHour + 1 }, (_, i) => {
    const hour = i + config.firstHour;
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
            {config.title}
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
          {config.title}
        </CardTitle>
        <CardDescription>
          {config.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor={`${config.eventType}-enabled`} className="text-base">
            {config.toggleLabel}
          </Label>
          <Switch
            id={`${config.eventType}-enabled`}
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Time Selector */}
        <div className="space-y-2">
          <Label htmlFor={`${config.eventType}-time`} className="text-sm font-medium">
            Hora de envío
          </Label>
          <Select value={scheduleTime} onValueChange={setScheduleTime} disabled={!enabled}>
            <SelectTrigger id={`${config.eventType}-time`} className="w-full">
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
                  id={`${config.eventType}-day-${day.value}`}
                  checked={daysOfWeek.includes(day.value)}
                  onCheckedChange={() => toggleDay(day.value)}
                  disabled={!enabled}
                />
                <Label
                  htmlFor={`${config.eventType}-day-${day.value}`}
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
            {config.info}
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
