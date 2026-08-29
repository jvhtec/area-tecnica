/**
 * The (affectionate) commentary behind the medal icons on a technician row.
 *
 * Lives outside TechnicianRow so the row component stays about layout, and so
 * the copy can be reviewed on its own. `{year}` in the last-year lines is
 * substituted by the caller, which owns the clock.
 */

type MedalRank = 'gold' | 'silver' | 'bronze';

/**
 * Picks a list entry from a seed. Math.random() here made render impure: the
 * medal tooltip drew a different line on every re-render of the matrix.
 */
const pickStableIndex = (seed: string, length: number) => {
  if (length <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % length;
};

const CURRENT_YEAR_COMMENTS: Record<MedalRank, string[]> = {
  gold: [
    '¡El campeón indiscutible! ¿Será que no tiene vida fuera del trabajo?',
    'Oro puro. Probablemente duerme con el móvil debajo de la almohada.',
    'El número uno. Los demás técnicos lloran en la esquina.',
    '¡Medalla de oro! ¿Seguro que no eres un robot?',
    'Primer puesto. Tu cuenta bancaria debe estar feliz.',
    '¡Oro! Los demás están tomando notas furiosamente.',
    'Rey o reina de los bolos. ¿Cuándo descansas?',
    'Medalla dorada. Hasta tu sombra trabaja más que los demás.',
    '¡Campeón! Probablemente rechazas vacaciones por diversión.',
    'Número uno con bala. Los otros técnicos necesitan un plan.',
  ],
  silver: [
    'Plata. Cerca pero no lo suficiente. ¿Quizás el próximo mes?',
    'Segundo lugar. El primer perdedor, como dicen por ahí.',
    'Medalla de plata. Al menos no eres bronce.',
    '¡Subcampeón! Tan cerca y tan lejos a la vez.',
    'Plata reluciente. El oro te mira desde arriba.',
    'Número dos. Como Pepsi, siempre detrás de Coca-Cola.',
    'Medalla plateada. Tu esfuerzo es... respetable.',
    '¡Plata! Casi oro, pero casi no cuenta.',
    'Segundo puesto. El primero de los perdedores.',
    'Plata brillante. El oro te envía saludos desde el podio.',
  ],
  bronze: [
    'Bronce. Al menos estás en el podio... apenas.',
    'Tercer lugar. Mejor que nada, ¿no?',
    'Medalla de bronce. Los demás te miran con lástima.',
    '¡Bronce! Felicidades por ser el último en el podio.',
    'Tercero. Es como decir "casi competente".',
    'Medalla de bronce. Al menos no eres cuarto.',
    '¡Bronce! Tu mamá está orgullosa, probablemente.',
    'Tercer puesto. Los otros dos te saludan desde arriba.',
    'Bronce resplandeciente. Bueno, más o menos resplandeciente.',
    'Número tres. Podría ser peor... o mejor.',
  ],
};

const LAST_YEAR_COMMENTS: Record<MedalRank, string[]> = {
  gold: [
    'Fuiste oro el año pasado. ¿Qué pasó? ¿Te jubilaste?',
    'Campeón del año pasado. Ahora... no tanto. ¿Nostalgia?',
    'Oro en {year}. ¿Dónde quedó esa energía?',
    'Eras el número uno. Pasado perfecto, presente... dudoso.',
    '¡Medalla de oro histórica! Énfasis en "histórica".',
    'Top del año pasado. Las glorias pasadas no pagan facturas.',
    'Fuiste el rey. Ahora más bien... plebeyo.',
    'Eras imparable. ¿Te pararon?',
    'Oro {year}. ¿Ya te cansaste o simplemente te dio pereza?',
    'Campeón que fue. La clave está en "fue".',
  ],
  silver: [
    'Plata el año pasado. Ni oro entonces, ni ahora.',
    'Segundo en {year}. Al menos eres consistente... en no ganar.',
    'Medalla plateada histórica. ¿Sigues casi ganando?',
    'Subcampeón del pasado. ¿Cuándo será tu año de verdad?',
    'Plata en {year}. Eternamente segundo, ¿no?',
    'Casi ganaste el año pasado. Casi. Como siempre.',
    'Segundo puesto histórico. ¿Te suena familiar?',
    'Plata vintage. Tu zona de confort es el segundo lugar.',
    'Fuiste plata. Sorpresa: sigues sin ser oro.',
    'Subcampeón perenne. El oro te envía saludos del pasado.',
  ],
  bronze: [
    'Bronce el año pasado. ¿Bajaste o ya estabas abajo?',
    'Tercero en {year}. ¿Vas pa bajo o qué?',
    'Medalla de bronce histórica. Última del podio... qué logro.',
    'Tercer puesto del pasado. ¿Al menos mantienes el ritmo?',
    'Bronce {year}. Podio por los pelos, como siempre.',
    'Último en el podio el año pasado. ¿Sigues ahí?',
    'Bronce vintage. Sigues siendo el tercero más motivado.',
    'Tercer lugar histórico. Los otros dos no te extrañan.',
    'Fuiste bronce. ¿Fuiste, eres o vas para allá?',
    'Podio del año pasado. Énfasis en "último del podio".',
  ],
};

export const currentYearMedalComment = (technicianId: string, rank: MedalRank) => {
  const list = CURRENT_YEAR_COMMENTS[rank];
  return list[pickStableIndex(`${technicianId}:${rank}`, list.length)];
};

export const lastYearMedalComment = (technicianId: string, rank: MedalRank, lastYear: number) => {
  const list = LAST_YEAR_COMMENTS[rank];
  return list[pickStableIndex(`${technicianId}:last:${rank}`, list.length)].replace('{year}', String(lastYear));
};

export const MEDAL_COLORS: Record<MedalRank, string> = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
};

export type { MedalRank };
