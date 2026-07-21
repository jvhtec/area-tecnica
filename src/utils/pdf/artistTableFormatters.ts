export const FESTIVAL_TEXT_TOKEN = '__FESTIVAL_ITEM__';
export const BAND_TEXT_TOKEN = '__BAND_ITEM__';

interface ArtistInfrastructure {
  infra_cat6?: boolean;
  infra_cat6_quantity?: number;
  infra_hma?: boolean;
  infra_hma_quantity?: number;
  infra_coax?: boolean;
  infra_coax_quantity?: number;
  infra_opticalcon_duo?: boolean;
  infra_opticalcon_duo_quantity?: number;
  infra_analog?: number;
  other_infrastructure?: string;
}

interface WirelessSystemPdf {
  model?: string;
  provided_by?: string;
  quantity?: number;
  quantity_ch?: number;
  quantity_hh?: number;
  quantity_bp?: number;
}

export function formatInfrastructureForPdf(
  infrastructure: ArtistInfrastructure | null | undefined,
): string {
  console.log('formatInfrastructureForPdf called with:', infrastructure);
  if (!infrastructure) {
    console.log('No infrastructure data provided');
    return 'Ninguno';
  }

  const items: string[] = [];
  try {
    if (infrastructure.infra_cat6 && infrastructure.infra_cat6_quantity) {
      items.push(`${infrastructure.infra_cat6_quantity}x CAT6`);
    }
    if (infrastructure.infra_hma && infrastructure.infra_hma_quantity) {
      items.push(`${infrastructure.infra_hma_quantity}x HMA`);
    }
    if (infrastructure.infra_coax && infrastructure.infra_coax_quantity) {
      items.push(`${infrastructure.infra_coax_quantity}x Coax`);
    }
    if (infrastructure.infra_opticalcon_duo && infrastructure.infra_opticalcon_duo_quantity) {
      items.push(`${infrastructure.infra_opticalcon_duo_quantity}x OpticalCON DUO`);
    }
    if (infrastructure.infra_analog && infrastructure.infra_analog > 0) {
      items.push(`${infrastructure.infra_analog}x Analog`);
    }
    if (infrastructure.other_infrastructure) {
      items.push(infrastructure.other_infrastructure);
    }

    console.log('Infrastructure items found:', items);
    return items.length > 0 ? items.join(', ') : 'Ninguno';
  } catch (error) {
    console.error('Error formatting infrastructure:', error);
    return 'Error formatting infrastructure';
  }
}

export function formatWiredMicsForPdf(
  mics: Array<{ model: string; quantity: number; exclusive_use?: boolean; notes?: string }> = [],
  _micKit = 'band',
): string {
  if (mics.length === 0) return 'Ninguno';
  return mics.map((mic) => {
    const exclusiveIndicator = mic.exclusive_use ? ' (E)' : '';
    return `${mic.quantity}x ${mic.model}${exclusiveIndicator}`;
  }).join(', ');
}

export function formatWirelessSystemsForPdf(
  systems: WirelessSystemPdf[] = [],
  providedBy = 'festival',
  isIEM = false,
): string {
  if (systems.length === 0) return 'Ninguno';

  return systems.map((system) => {
    const channels = isIEM
      ? system.quantity_hh || system.quantity || 0
      : system.quantity_ch || 0;
    const handhelds = system.quantity_hh || 0;
    const bodypacks = system.quantity_bp || 0;
    const totalTransmitters = handhelds + bodypacks;
    let details: string;

    if (isIEM) {
      details = `${channels} ch${bodypacks > 0 ? `, ${bodypacks} bp` : ''}`;
    } else if (handhelds > 0 && bodypacks > 0) {
      const channelPart = channels > 0 ? `${channels} ch, ` : '';
      details = `${channelPart}${handhelds}x HH, ${bodypacks}x BP`;
    } else if (totalTransmitters > 0) {
      const channelPart = channels > 0 ? `${channels} ch, ` : '';
      details = `${channelPart}${totalTransmitters}x`;
    } else if (channels > 0) {
      details = `${channels} ch`;
    } else {
      details = '';
    }

    const modelAndDetails = details ? `${system.model}: ${details}` : `${system.model}`;
    if (providedBy !== 'mixed') return modelAndDetails;

    const provider = system.provided_by || 'festival';
    const providerLabel = provider === 'festival' ? 'Festival' : 'Banda';
    const providerToken = provider === 'festival' ? FESTIVAL_TEXT_TOKEN : BAND_TEXT_TOKEN;
    return `${providerToken}${providerLabel}: ${modelAndDetails}`;
  }).join(providedBy === 'mixed' ? '\n' : '; ');
}
