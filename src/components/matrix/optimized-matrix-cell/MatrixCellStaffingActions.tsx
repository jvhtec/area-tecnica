import React from 'react';
import { CheckCircle, Mail, MessageCircle } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
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

type Tone = 'sky' | 'emerald' | 'muted';
const TONE_HOVER: Record<Tone, string> = {
  sky: 'hover:border-sky-500/40 hover:bg-sky-500/15',
  emerald: 'hover:border-emerald-500/40 hover:bg-emerald-500/15',
  muted: 'opacity-70 hover:bg-muted',
};
// No backdrop-blur: this sits on most empty cells, and hundreds of live
// backdrop filters made every scroll frame recomposite the grid behind them.
const BUTTON_BASE = 'rounded-full border border-transparent bg-background/70 p-0 shadow-sm transition-colors';

// This cluster renders on almost every empty cell, and a new row or column of
// cells mounts on each scroll step. The Button primitive resolved its classes
// (cva + tailwind-merge) and went through Slot on every render; these are the
// exact strings it produced, resolved once.
const buildButtonClass = (mobile: boolean, tone: Tone) =>
  cn(
    buttonVariants({ variant: 'ghost', size: mobile ? 'default' : 'sm' }),
    mobile ? 'h-7 w-7' : 'h-6 w-6',
    BUTTON_BASE,
    TONE_HOVER[tone],
  );
const BUTTON_CLASS: Record<'mobile' | 'desktop', Record<Tone, string>> = {
  mobile: { sky: buildButtonClass(true, 'sky'), emerald: buildButtonClass(true, 'emerald'), muted: buildButtonClass(true, 'muted') },
  desktop: { sky: buildButtonClass(false, 'sky'), emerald: buildButtonClass(false, 'emerald'), muted: buildButtonClass(false, 'muted') },
};

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
  const classes = BUTTON_CLASS[mobile ? 'mobile' : 'desktop'];
  const iconClass = mobile ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const offerTone: Tone = canSendOffer ? 'emerald' : 'muted';
  const offerIconClass = `${iconClass} ${canSendOffer ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}`;

  return (
    <div className={`${positionClass} z-10 flex gap-1`}>
      {canAskAvailability && (
        <>
          {showAvailabilityEmail && (
            <button
              type="button"
              className={classes.sky}
              onClick={onAvailabilityEmail}
              disabled={disabled}
              title="Solicitar disponibilidad"
            >
              <Mail className={`${iconClass} text-sky-600 dark:text-sky-400`} />
            </button>
          )}
          {showAvailabilityWhatsapp && (
            <button
              type="button"
              className={classes.emerald}
              onClick={onAvailabilityWhatsapp}
              disabled={disabled}
              title="Solicitar disponibilidad por WhatsApp"
            >
              <MessageCircle className={`${iconClass} text-emerald-600 dark:text-emerald-400`} />
            </button>
          )}
        </>
      )}

      {canShowOfferAction && (
        <>
          {showOfferEmail && (
            <button
              type="button"
              className={classes[offerTone]}
              onClick={onOfferEmail}
              disabled={disabled}
              title={canSendOffer ? 'Enviar oferta' : 'Enviar oferta (progreso manual)'}
            >
              <CheckCircle
                className={offerIconClass}
              />
            </button>
          )}
          {showOfferWhatsapp && (
            <button
              type="button"
              className={classes[offerTone]}
              onClick={onOfferWhatsapp}
              disabled={disabled}
              title={canSendOffer ? 'Enviar oferta por WhatsApp' : 'Enviar oferta por WhatsApp (progreso manual)'}
            >
              <MessageCircle
                className={offerIconClass}
              />
            </button>
          )}
        </>
      )}
    </div>
  );
};
