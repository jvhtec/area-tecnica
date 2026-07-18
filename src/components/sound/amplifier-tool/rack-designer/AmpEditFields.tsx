import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RackDesignerAmp } from './types';
import { isValidIp } from './layout-utils';

interface AmpEditFieldsProps {
  amp: RackDesignerAmp;
  onChange: (patch: Partial<RackDesignerAmp>) => void;
  /** Autofocus the IP field — the most common edit when tapping a cell. */
  autoFocusIp?: boolean;
}

export function AmpEditFields({ amp, onChange, autoFocusIp = false }: AmpEditFieldsProps) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label htmlFor={`amp-preset-${amp.id}`} className="text-xs">Preset</Label>
        <Input
          id={`amp-preset-${amp.id}`}
          value={amp.presetName}
          onChange={(event) => onChange({ presetName: event.target.value })}
          placeholder="Nombre del preset"
          className="h-8 text-sm font-semibold"
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`amp-ip-${amp.id}`} className="text-xs">Dirección IP</Label>
        <Input
          id={`amp-ip-${amp.id}`}
          value={amp.ip}
          onChange={(event) => onChange({ ip: event.target.value })}
          placeholder="192.168.1.11"
          inputMode="decimal"
          autoFocus={autoFocusIp}
          className={cn('h-8 font-mono text-sm', !isValidIp(amp.ip) && 'border-destructive')}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{amp.model}</p>
    </div>
  );
}
