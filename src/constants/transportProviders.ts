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
  }
> = {
  camionaje: {
    label: 'Camionaje',
    icon: '/Logos/Camionaje.png',
  },
  transluminaria: {
    label: 'Transluminaria',
    icon: '/Logos/Transluminaria.png',
  },
  the_wild_tour: {
    label: 'The Wild Tour',
    icon: '/Logos/The wild tour.png',
  },
  pantoja: {
    label: 'Pantoja',
    icon: '/Logos/Paantoja.png',
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
    icon: '/Logos/Grupo Sese.png',
  },
  nacex: {
    label: 'Nacex',
    icon: '/Logos/Nacex.png',
  },
  sector_pro: {
    label: 'Sector-Pro',
    icon: '/Logos/sector pro.png',
  },
  recogida_cliente: {
    label: 'Recogida Cliente',
    icon: null,
  },
};
