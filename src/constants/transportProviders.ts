export type TransportProvider =
  | 'camionaje'
  | 'transluminaria'
  | 'the_wild_tour'
  | 'pantoja'
  | 'crespo'
  | 'montabi_dorado'
  | 'grupo_sese'
  | 'nacex'
  | 'sector_pro'
  | 'recogida_cliente';

export const TRANSPORT_PROVIDERS: Record<
  TransportProvider,
  {
    label: string;
    icon: string | null;
    /**
     * `light` marks a white-on-transparent logo file. Light surfaces must darken
     * it (e.g. `filter: brightness(0)`) or it disappears.
     */
    tone?: 'light';
  }
> = {
  camionaje: {
    label: 'Camionaje',
    icon: '/Logos/Logo-Camionaje.png',
    tone: 'light',
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
    tone: 'light',
  },
  nacex: {
    label: 'Nacex',
    icon: '/Logos/logo-nacex-grande-20-aniversario1.png',
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
