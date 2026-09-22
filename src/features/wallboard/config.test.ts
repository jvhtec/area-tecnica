import { describe, expect, it } from 'vitest';

import { DEFAULT_PANEL_ORDER, normalisePanelOrder } from './config';

describe('normalisePanelOrder', () => {
  it('preserva los paneles desactivados intencionadamente', () => {
    expect(normalisePanelOrder(['calendar'])).toEqual(['calendar']);
  });

  it('elimina duplicados y claves desconocidas sin reactivar paneles', () => {
    expect(normalisePanelOrder(['crew', 'unknown', 'crew', 'pending'])).toEqual([
      'crew',
      'pending',
    ]);
  });

  it.each([undefined, null, [], ['unknown']])(
    'usa todos los paneles para una configuración ausente, vacía o inválida: %j',
    (order) => {
      expect(normalisePanelOrder(order)).toEqual(DEFAULT_PANEL_ORDER);
    },
  );
});
