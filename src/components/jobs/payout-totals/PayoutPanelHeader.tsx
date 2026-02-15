import React from 'react';
import { Euro, FileDown, ExternalLink, Send } from 'lucide-react';
import { CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { controlButton } from './types';

interface PayoutPanelHeaderProps {
  isManager: boolean;
  isExporting: boolean;
  isSendingEmails: boolean;
  isLoadingPreview: boolean;
  hasPayouts: boolean;
  onExport: () => void;
  onPreview: () => void;
  onSendEmails: () => void;
}

export function PayoutPanelHeader({
  isManager,
  isExporting,
  isSendingEmails,
  isLoadingPreview,
  hasPayouts,
  onExport,
  onPreview,
  onSendEmails,
}: PayoutPanelHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <CardTitle className="flex items-center gap-2 text-lg">
        <Euro className="h-5 w-5" />
        Pagos del trabajo
      </CardTitle>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={onExport}
          disabled={isExporting || !hasPayouts}
          className={controlButton}
        >
          <FileDown className="h-4 w-4 mr-1" />
          {isExporting ? 'Generando\u2026' : 'Exportar PDF'}
        </Button>
        {isManager && (
          <Button
            variant="outline"
            size="sm"
            onClick={onPreview}
            disabled={isLoadingPreview || !hasPayouts}
            className={controlButton}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            {isLoadingPreview ? 'Cargando\u2026' : 'Previsualizar'}
          </Button>
        )}
        <Button
          size="sm"
          onClick={onSendEmails}
          disabled={isSendingEmails || !hasPayouts}
          variant="default"
          className="bg-blue-600 hover:bg-blue-500 text-white"
        >
          <Send className="h-4 w-4 mr-1" />
          {isSendingEmails ? 'Enviando\u2026' : 'Enviar aprobados'}
        </Button>
      </div>
    </div>
  );
}
