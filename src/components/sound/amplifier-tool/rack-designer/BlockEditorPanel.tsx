import { useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { RackDesignerAmp, RackDesignerBlock } from './types';
import {
  DEFAULT_IP_BASE,
  RACK_COLOR_PALETTE,
  assignBlockIps,
  incrementIp,
  isValidIp,
  makeDesignerId,
} from './layout-utils';

interface BlockEditorPanelProps {
  block: RackDesignerBlock;
  onChange: (block: RackDesignerBlock) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function BlockEditorPanel({ block, onChange, onDuplicate, onDelete }: BlockEditorPanelProps) {
  const [blockBaseIp, setBlockBaseIp] = useState(block.amps[0]?.ip || DEFAULT_IP_BASE);

  const updateAmp = (ampId: string, patch: Partial<RackDesignerAmp>) => {
    onChange({
      ...block,
      amps: block.amps.map((amp) => (amp.id === ampId ? { ...amp, ...patch } : amp)),
    });
  };

  const moveAmp = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= block.amps.length) return;
    const amps = [...block.amps];
    [amps[index], amps[target]] = [amps[target], amps[index]];
    onChange({ ...block, amps });
  };

  const removeAmp = (ampId: string) => {
    onChange({ ...block, amps: block.amps.filter((amp) => amp.id !== ampId) });
  };

  const addAmp = () => {
    const last = block.amps[block.amps.length - 1];
    onChange({
      ...block,
      amps: [
        ...block.amps,
        {
          id: makeDesignerId(),
          presetName: 'PRESET',
          model: last?.model ?? 'LA12X',
          ip: last && isValidIp(last.ip) ? incrementIp(last.ip, 1) : DEFAULT_IP_BASE,
        },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="rack-label" className="text-xs">Nombre del rack</Label>
        <Input
          id="rack-label"
          value={block.label}
          onChange={(event) => onChange({ ...block, label: event.target.value })}
          className="h-8"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Color del grupo</Label>
        <div className="flex flex-wrap gap-1.5">
          {RACK_COLOR_PALETTE.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.name}
              aria-label={color.name}
              className={cn(
                'h-6 w-6 rounded-full border border-black/30 transition-transform hover:scale-110',
                block.color === color.value && 'ring-2 ring-primary ring-offset-1',
              )}
              style={{ backgroundColor: color.value }}
              onClick={() => onChange({ ...block, color: color.value })}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rack-base-ip" className="text-xs">IP inicial del rack</Label>
        <div className="flex gap-1.5">
          <Input
            id="rack-base-ip"
            value={blockBaseIp}
            onChange={(event) => setBlockBaseIp(event.target.value)}
            placeholder={DEFAULT_IP_BASE}
            className={cn('h-8 font-mono text-xs', !isValidIp(blockBaseIp) && 'border-destructive')}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 shrink-0"
            disabled={!isValidIp(blockBaseIp)}
            onClick={() => onChange(assignBlockIps(block, blockBaseIp))}
          >
            Asignar IPs
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Amplificadores ({block.amps.length})</Label>
        {block.amps.map((amp, index) => (
          <div key={amp.id} className="rounded-md border p-2 space-y-1.5">
            <div className="flex items-center gap-1">
              <Input
                value={amp.presetName}
                onChange={(event) => updateAmp(amp.id, { presetName: event.target.value })}
                placeholder="Nombre del preset"
                className="h-7 text-xs font-semibold"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={index === 0}
                onClick={() => moveAmp(index, -1)}
                aria-label="Subir amplificador"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                disabled={index === block.amps.length - 1}
                onClick={() => moveAmp(index, 1)}
                aria-label="Bajar amplificador"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-destructive"
                onClick={() => removeAmp(amp.id)}
                aria-label="Eliminar amplificador"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={amp.ip}
                onChange={(event) => updateAmp(amp.id, { ip: event.target.value })}
                placeholder="192.168.1.11"
                className={cn('h-7 font-mono text-xs', !isValidIp(amp.ip) && 'border-destructive')}
              />
              <span className="shrink-0 text-[10px] text-muted-foreground">{amp.model}</span>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-full gap-1" onClick={addAmp}>
          <Plus className="h-3.5 w-3.5" />
          Añadir amplificador
        </Button>
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="flex-1 gap-1"
          onClick={() => onDuplicate(block.id)}
        >
          <Copy className="h-3.5 w-3.5" />
          Duplicar
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="flex-1 gap-1"
          onClick={() => onDelete(block.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </Button>
      </div>
    </div>
  );
}
