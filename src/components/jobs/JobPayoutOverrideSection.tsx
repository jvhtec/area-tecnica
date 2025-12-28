import React from 'react';
import { Edit2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency } from '@/lib/utils';

export type JobPayoutOverride = {
  technician_id: string;
  override_amount_eur: number;
};

export const JobPayoutOverrideSection: React.FC<{
  override?: JobPayoutOverride;
  isEditing: boolean;
  techName: string;
  calculatedTotalEur: number;
  editingAmount: string;
  onEditingAmountChange: (next: string) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  isSaving: boolean;
  isRemoving: boolean;
}> = ({
  override,
  isEditing,
  techName,
  calculatedTotalEur,
  editingAmount,
  onEditingAmountChange,
  onStartEdit,
  onSave,
  onCancel,
  onRemove,
  isSaving,
  isRemoving,
}) => (
    <div className="space-y-2">
      {override && !isEditing && (
        <div className="text-xs bg-amber-500/10 p-2 rounded border border-amber-500/30 text-amber-200">
          <div className="flex justify-between items-center">
            <span className="font-medium">Override activo:</span>
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatCurrency(override.override_amount_eur)}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={onStartEdit}
                className="h-6 px-2 text-amber-200 hover:text-amber-100 hover:bg-amber-500/20"
                aria-label="Editar override"
              >
                <Edit2 className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={onRemove}
                disabled={isRemoving}
                className="h-6 px-2 text-red-300 hover:text-red-200 hover:bg-red-500/20"
                aria-label="Eliminar override"
              >
                {isRemoving ? <Loader2 className="h-3 w-3 animate-spin" /> : "×"}
              </Button>
            </div>
          </div>
          <div className="text-xs mt-1 opacity-75">Calculado: {formatCurrency(calculatedTotalEur)}</div>
        </div>
      )}

      {isEditing && (
        <div className="bg-amber-500/10 p-3 rounded border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs text-amber-200">
            <Edit2 className="h-3.5 w-3.5" />
            <span className="font-medium">Override de pago para {techName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={editingAmount}
              onChange={(e) => onEditingAmountChange(e.target.value)}
              placeholder="0.00"
              className="flex-1 bg-white/10 border-amber-400/50 text-white placeholder:text-slate-400 h-8"
              autoFocus
            />
            <Button size="sm" onClick={onSave} disabled={isSaving} className="bg-amber-600 hover:bg-amber-500 text-white h-8">
              {isSaving ? 'Guardando...' : 'Guardar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={onCancel} className="text-white hover:bg-white/10 h-8">
              Cancelar
            </Button>
          </div>
          <div className="text-xs text-amber-200">Calculado: {formatCurrency(calculatedTotalEur)}</div>
        </div>
      )}

      {!override && !isEditing && (
        <Button
          size="sm"
          variant="outline"
          onClick={onStartEdit}
          className="w-full border-amber-500/30 text-amber-200 hover:bg-amber-500/10 hover:text-amber-100"
        >
          <Edit2 className="h-3 w-3 mr-1" />
          Establecer override de pago
        </Button>
      )}
    </div>
  );
