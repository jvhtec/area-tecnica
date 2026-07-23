import React, { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Save,
  ChevronLeft,
  Calendar as CalendarIcon,
  MapPin,
  Play,
  Coffee,
  PenTool,
  Euro,
  X,
  Check,
  AlertCircle,
  Moon,
  RefreshCw,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useJobPayoutTotals } from '@/hooks/useJobPayoutTotals';
import { useJobRatesApproval } from '@/hooks/useJobRatesApproval';
import { formatCurrency } from '@/lib/utils';
import { isJobPastClosureWindow } from '@/utils/jobClosureUtils';
import { isTechnicianRole } from '@/utils/permissions';
import { isPrepDayBreakdown, isPrepDayTimesheet, prepDayHourlyRate } from '@/utils/timesheetPrepDays';
import { Timesheet, TimesheetFormData } from '@/types/timesheet';
import SignatureCanvas from 'react-signature-canvas';
import { Theme } from './types';
import {
  calculateHours,
  getStatusBadge,
  SENDABLE_TIMESHEET_STATUSES,
  type TechnicianTimesheetViewProps,
} from "./technicianTimesheetTypes";

import type { Dispatch, RefObject, SetStateAction } from "react";

interface TechnicianTimesheetPromptsProps {
  theme: Theme;
  isDark: boolean;
  sendPromptId: string | null;
  setSendPromptId: Dispatch<SetStateAction<string | null>>;
  isSendingPrompt: boolean;
  sendDay: (timesheetId: string, options?: { closeAfter?: boolean }) => Promise<void>;
  showExitConfirm: boolean;
  setShowExitConfirm: Dispatch<SetStateAction<boolean>>;
  editedUnsent: Timesheet[];
  onClose: () => void;
  openSignatureDialog: (timesheetId: string) => void;
  signatureDialogOpen: boolean;
  setSignatureDialogOpen: Dispatch<SetStateAction<boolean>>;
  setSigningTimesheetId: Dispatch<SetStateAction<string | null>>;
  signaturePadRef: RefObject<SignatureCanvas>;
  clearSignature: () => void;
  handleSaveSignature: () => Promise<void>;
  isSignatureSaving: boolean;
}

export const TechnicianTimesheetPrompts = ({
  theme, isDark, sendPromptId, setSendPromptId, isSendingPrompt, sendDay,
  showExitConfirm, setShowExitConfirm, editedUnsent, onClose, openSignatureDialog,
  signatureDialogOpen, setSignatureDialogOpen, setSigningTimesheetId, signaturePadRef,
  clearSignature, handleSaveSignature, isSignatureSaving,
}: TechnicianTimesheetPromptsProps) => (
  <>
      {/* Post-save nudge — prompt to send the day that was just edited */}
      {sendPromptId && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center ${theme.modalOverlay || 'bg-black/90 backdrop-blur-md'} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
          <div className={`w-full max-w-sm ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-emerald-500/15">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                </div>
                <h3 className={`font-bold text-lg ${theme.textMain}`}>Parte firmado</h3>
              </div>
              <p className={`text-sm ${theme.textMuted} mb-5`}>
                Has firmado el parte pero todavía no se ha enviado. Envíalo ahora
                para que pase a aprobación.
              </p>
              <div className="space-y-2">
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                  disabled={isSendingPrompt}
                  onClick={() => sendDay(sendPromptId)}
                >
                  {isSendingPrompt ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 size={16} className="mr-2" />
                  )}
                  Enviar parte
                </Button>
                <button
                  className={`w-full text-center text-xs ${theme.textMuted} py-2 disabled:opacity-50`}
                  disabled={isSendingPrompt}
                  onClick={() => setSendPromptId(null)}
                >
                  Más tarde
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exit guard — block leaving with an edited-but-unsent day */}
      {showExitConfirm && editedUnsent.length > 0 && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center ${theme.modalOverlay || 'bg-black/90 backdrop-blur-md'} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
          <div className={`w-full max-w-sm ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-full bg-amber-500/15">
                  <AlertTriangle size={20} className="text-amber-500" />
                </div>
                <h3 className={`font-bold text-lg ${theme.textMain}`}>Parte sin enviar</h3>
              </div>
              <p className={`text-sm ${theme.textMuted} mb-5`}>
                Editaste el parte del{' '}
                <span className={`font-bold ${theme.textMain}`}>
                  {format(parseISO(editedUnsent[0].date), "d 'de' MMMM", { locale: es })}
                </span>{' '}
                pero no lo has enviado. Si sales ahora no pasará a aprobación.
                {!editedUnsent[0].signature_data && ' Debes firmarlo para poder enviarlo.'}
              </p>
              <div className="space-y-2">
                {editedUnsent[0].signature_data ? (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    disabled={isSendingPrompt}
                    onClick={() => sendDay(editedUnsent[0].id, { closeAfter: editedUnsent.length === 1 })}
                  >
                    {isSendingPrompt ? (
                      <Loader2 size={16} className="mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 size={16} className="mr-2" />
                    )}
                    Enviar parte{editedUnsent.length === 1 ? ' y salir' : ''}
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                    disabled={isSendingPrompt}
                    onClick={() => {
                      setShowExitConfirm(false);
                      openSignatureDialog(editedUnsent[0].id);
                    }}
                  >
                    <PenTool size={16} className="mr-2" />
                    Firmar y enviar
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={isSendingPrompt}
                  onClick={() => setShowExitConfirm(false)}
                >
                  Seguir editando
                </Button>
                <button
                  className={`w-full text-center text-xs ${theme.textMuted} py-2 disabled:opacity-50`}
                  disabled={isSendingPrompt}
                  onClick={() => {
                    setShowExitConfirm(false);
                    onClose();
                  }}
                >
                  Salir sin enviar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal - Custom implementation matching incident report */}
      {signatureDialogOpen && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center ${theme.modalOverlay || 'bg-black/90 backdrop-blur-md'} px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] animate-in fade-in duration-200`}>
          <div className={`w-full max-w-md ${isDark ? 'bg-[#0f1219]' : 'bg-white'} rounded-2xl border ${theme.divider} shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200`}>
            <div className={`p-4 border-b ${theme.divider} flex justify-between items-center`}>
              <h3 className={`font-bold ${theme.textMain}`}>Firma Digital</h3>
              <button
                onClick={() => {
                  setSignatureDialogOpen(false);
                  setSigningTimesheetId(null);
                }}
                className={`p-1 ${theme.textMuted} hover:opacity-70`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4">
              <div className={`border-2 border-dashed ${isDark ? 'border-gray-700 bg-white/5' : 'border-slate-300 bg-slate-50'} rounded-xl overflow-hidden mb-4`}>
                <SignatureCanvas
                  ref={signaturePadRef}
                  canvasProps={{
                    className: 'signature-canvas w-full h-40',
                    style: { width: '100%', height: '160px' },
                  }}
                  backgroundColor="transparent"
                  penColor={isDark ? 'white' : 'black'}
                />
              </div>

              <p className={`text-xs ${theme.textMuted} text-center mb-4`}>
                Al firmar, certifico que las horas registradas son correctas.
              </p>

              <div className="flex gap-3">
                <Button variant="outline" onClick={clearSignature} className="flex-1">
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
                <Button
                  onClick={handleSaveSignature}
                  disabled={isSignatureSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isSignatureSaving ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
  </>
);
