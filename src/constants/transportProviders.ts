import type { Transport } from "@/types/hoja-de-ruta";

export type TransportProvider =
  | 'camionaje'
  | 'transluminaria'
  | 'the_wild_tour'
  | 'pantoja'
  | 'crespo'
  | 'montabi_dorado'
  | 'grupo_sese'
  | 'nacex'
  | 'montoya'
  | 'sector_pro'
  | 'recogida_cliente';

export const TRANSPORT_PROVIDERS: Record<
  TransportProvider,
  {
    label: string;
    icon: string | null;
  }
> = {
  camionaje: {
    label: 'Camionaje',
    icon: '/Logos/Logo-Camionaje.png',
  },
  transluminaria: {
    label: 'Transluminaria',
    icon: '/Logos/logo_transluminaria.png',
  },
  the_wild_tour: {
    label: 'The Wild Tour',
    icon: '/Logos/wild tour.png',
  },
  pantoja: {
    label: 'Pantoja',
    icon: '/Logos/Logo-pantoja.png',
  },
  crespo: {
    label: 'Crespo',
    icon: '/Logos/Crespo.png',
  },
  montabi_dorado: {
    label: 'Montabi-Dorado',
    icon: null,
  },
  grupo_sese: {
    label: 'Grupo Sesé',
    icon: '/Logos/Logo_Sese60_blanco_RGB.png',
  },
  nacex: {
    label: 'Nacex',
    icon: '/Logos/logo-nacex-grande-20-aniversario1.png',
  },
  montoya: {
    label: 'Montoya',
    icon: null,
  },
  sector_pro: {
    label: 'Sector-Pro',
    icon: '/Logos/sector pro logo.png',
  },
  recogida_cliente: {
    label: 'Recogida Cliente',
    icon: null,
  },
};

/** Display name of a stored provider value; unknown values are shown as stored. */
export const transportProviderLabel = (value: string | null | undefined): string | null =>
  value ? (TRANSPORT_PROVIDERS as Record<string, { label: string } | undefined>)[value]?.label ?? value : null;


/** Canonical mapping from logistics provider values to the Hoja transport domain. */
export const transportProviderToHojaCompany = (
  value: string | null | undefined,
): Transport["company"] | undefined => {
  if (!value) return undefined;
  const aliases: Record<string, Transport["company"]> = {
    pantoja: "pantoja",
    transluminaria: "transluminaria",
    transcamarena: "transcamarena",
    the_wild_tour: "wild tour",
    camionaje: "camionaje",
    sector_pro: "sector-pro",
    crespo: "crespo",
    montabi_dorado: "montabi_dorado",
    grupo_sese: "grupo_sese",
    nacex: "nacex",
    montoya: "montoya",
    recogida_cliente: "recogida_cliente",
  };
  return aliases[value] ?? "other";
};
