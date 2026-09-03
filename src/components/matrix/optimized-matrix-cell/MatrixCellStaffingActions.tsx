import React from 'react';
import { CheckCircle, Mail, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * The email / WhatsApp action cluster a cell offers for an unstaffed date.
 *
 * Sizing note kept from the original cell: these are deliberately NOT
 * `coarse-hit-target`. Four 44px targets cannot fit the 132px of usable width a
 * phone cell has, and a 44px ::after on a 30px centre pitch would overlap its
 * neighbour — a near-miss would fire the wrong staffing action. Dropping to two
 * comfortable controls is what the Email / WhatsApp toggles in the filters are
 * for.
 */

interface MatrixCellStaffingActionsProps {
  positionClass: string;
  mobile: boolean;
  disabled: boolean;
  canAskAvailability: boolean;
  canShowOfferAction: boolean;
  /** True once availability is confirmed: the offer is the expected next step. */
  canSendOffer: boolean;
  showAvailabilityEmail: boolean;
  showAvailabilityWhatsapp: boolean;
  showOfferEmail: boolean;
  showOfferWhatsapp: boolean;
  onAvailabilityEmail: (event: React.MouseEvent) => void;
  onAvailabilityWhatsapp: (event: React.MouseEvent) => void;
  onOfferEmail: (event: React.MouseEvent) => void;
  onOfferWhatsapp: (event: React.MouseEvent) => void;
}

export const MatrixCellStaffingActions: React.FC<MatrixCellStaffingActionsProps> = ({
  positionClass,
  mobile,
  disabled,
  canAskAvailability,
  canShowOfferAction,
  canSendOffer,
  showAvailabilityEmail,
  showAvailabilityWhatsapp,
  showOfferEmail,
  showOfferWhatsapp,
  onAvailabilityEmail,
  onAvailabilityWhatsapp,
  onOfferEmail,
  onOfferWhatsapp,
}) => {
  // Four 32px buttons plus gaps overflow a 140px mobile cell, so these are 28px.
  const sizeClass = mobile ? 'h-7 w-7' : 'h-6 w-6';
  const iconClass = mobile ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const buttonClass = 'rounded-full border border-transparent bg-background/70 p-0 shadow-sm backdrop-blur-sm transition-colors';

  return (
    <div className={cn(positionClass, 'z-10 flex', mobile ? 'gap-1' : 'gap-1')}>
      {canAskAvailability && (
        <>
          {showAvailabilityEmail && (
            <Button
              variant="ghost"
              size={mobile ? 'default' : 'sm'}
              className={cn(sizeClass, buttonClass, 'hover:border-sky-500/40 hover:bg-sky-500/15')}
              onClick={onAvailabilityEmail}
              disabled={disabled}
              title="Solicitar disponibilidad"
            >
              <Mail className={cn(iconClass, 'text-sky-600 dark:text-sky-400')} />
            </Button>
          )}
          {showAvailabilityWhatsapp && (
            <Button
              variant="ghost"
              size={mobile ? 'default' : 'sm'}
              className={cn(sizeClass, buttonClass, 'hover:border-emerald-500/40 hover:bg-emerald-500/15')}
              onClick={onAvailabilityWhatsapp}
              disabled={disabled}
              title="Solicitar disponibilidad por WhatsApp"
            >
              <MessageCircle className={cn(iconClass, 'text-emerald-600 dark:text-emerald-400')} />
            </Button>
          )}
        </>
      )}

      {canShowOfferAction && (
        <>
          {showOfferEmail && (
            <Button
              variant="ghost"
              size={mobile ? 'default' : 'sm'}
              className={cn(
                sizeClass,
                buttonClass,
                canSendOffer ? 'hover:border-emerald-500/40 hover:bg-emerald-500/15' : 'opacity-70 hover:bg-muted',
              )}
              onClick={onOfferEmail}
              disabled={disabled}
              title={canSendOffer ? 'Enviar oferta' : 'Enviar oferta (progreso manual)'}
            >
              <CheckCircle
                className={cn(iconClass, canSendOffer ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}
              />
            </Button>
          )}
          {showOfferWhatsapp && (
            <Button
              variant="ghost"
              size={mobile ? 'default' : 'sm'}
              className={cn(
                sizeClass,
                buttonClass,
                canSendOffer ? 'hover:border-emerald-500/40 hover:bg-emerald-500/15' : 'opacity-70 hover:bg-muted',
              )}
              onClick={onOfferWhatsapp}
              disabled={disabled}
              title={canSendOffer ? 'Enviar oferta por WhatsApp' : 'Enviar oferta por WhatsApp (progreso manual)'}
            >
              <MessageCircle
                className={cn(iconClass, canSendOffer ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}
              />
            </Button>
          )}
        </>
      )}
    </div>
  );
};
