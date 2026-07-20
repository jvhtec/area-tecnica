import { describe, expect, it } from 'vitest';

import { soundWeightComponents } from '@/features/technical-tools/weights/soundWeightComponents';
import { buildXmlpWeightTables } from '@/features/technical-tools/weights/xmlpWeightImport';

type XmlpArrayInput = Parameters<typeof buildXmlpWeightTables>[0]['arrays'][number];

const makeArray = (overrides: Partial<XmlpArrayInput> = {}): XmlpArrayInput => ({
  arrayName: 'MAIN L',
  groupName: 'PA',
  deployment: 'flown',
  riggingFrame: 'K2-BUMP',
  pickupConfiguration: '',
  totalMassKg: null,
  frontLoadKg: null,
  rearLoadKg: null,
  enclosures: [{ model: 'K2' }, { model: 'K2' }],
  ...overrides,
});

describe('buildXmlpWeightTables', () => {
  it('imports only flown arrays and leaves ground stacks out of motor tables', () => {
    const result = buildXmlpWeightTables({
      arrays: [
        makeArray(),
        makeArray({ arrayName: 'SUB L', deployment: 'stacked' }),
        makeArray({ arrayName: 'FRONT FILL', deployment: 'unknown' }),
      ],
    }, soundWeightComponents);

    expect(result.tables.map((table) => table.name)).toEqual(['MAIN L']);
  });

  it('uses the serialized XMLP mass instead of silently substituting catalog math', () => {
    const result = buildXmlpWeightTables({
      arrays: [makeArray({
        totalMassKg: 1180.6,
        frontLoadKg: 640.2,
        rearLoadKg: 540.4,
      })],
    }, soundWeightComponents);

    expect(result.exactMassTableCount).toBe(1);
    expect(result.warnings).toEqual([]);
    expect(result.tables[0]).toMatchObject({
      name: 'MAIN L',
      totalWeight: 1360.6,
      dualMotors: true,
      usedExactXmlpMass: true,
    });
    expect(result.tables[0].rows).toEqual([
      expect.objectContaining({
        quantity: '1',
        componentName: 'Peso total XMLP (2× K2 + K2-BUMP)',
        weight: '1180.6',
        totalWeight: 1180.6,
      }),
      expect.objectContaining({
        componentName: 'MOTOR 2T',
        quantity: '2',
        weight: '90',
        totalWeight: 180,
      }),
    ]);
  });

  it('falls back to the sound catalog and maps Soundvision rigging-frame aliases', () => {
    const result = buildXmlpWeightTables({
      arrays: [makeArray({ pickupConfiguration: 'Posiciones: 0 / 20' })],
    }, soundWeightComponents);

    expect(result.exactMassTableCount).toBe(0);
    expect(result.tables[0]).toMatchObject({
      totalWeight: 272,
      dualMotors: true,
      usedExactXmlpMass: false,
    });
    expect(result.tables[0].rows).toEqual([
      expect.objectContaining({ componentName: 'K2', quantity: '2', totalWeight: 112 }),
      expect.objectContaining({ componentName: 'BUMPER K2', quantity: '1', totalWeight: 60 }),
      expect.objectContaining({
        componentName: 'MOTOR 500Kg',
        quantity: '2',
        totalWeight: 100,
      }),
    ]);
    expect(result.warnings).toEqual([
      'MAIN L: peso derivado del catálogo; revisa el cableado.',
    ]);
  });

  it('maps the Soundvision M-BUMP name used by flown KARA II arrays', () => {
    const result = buildXmlpWeightTables({
      arrays: [makeArray({
        arrayName: 'Out L',
        riggingFrame: 'M-BUMP',
        pickupConfiguration: 'Posiciones: 0 / 2',
        enclosures: Array.from({ length: 12 }, () => ({ model: 'KARA II' })),
      })],
    }, soundWeightComponents);

    expect(result.tables[0]).toMatchObject({
      name: 'Out L',
      totalWeight: 420,
      dualMotors: true,
    });
    expect(result.tables[0].rows).toEqual([
      expect.objectContaining({ componentName: 'KARA II', quantity: '12', totalWeight: 300 }),
      expect.objectContaining({ componentName: 'BUMPER KARA', quantity: '1', totalWeight: 20 }),
      expect.objectContaining({ componentName: 'MOTOR 500Kg', quantity: '2', totalWeight: 100 }),
    ]);
  });

  it('adds one motor per pickup and applies a 20% capacity safety margin', () => {
    const result = buildXmlpWeightTables({
      arrays: [makeArray({
        pickupConfiguration: '1 motor',
        totalMassKg: 500,
      })],
    }, soundWeightComponents);

    expect(result.tables[0]).toMatchObject({
      totalWeight: 560,
      dualMotors: false,
    });
    expect(result.tables[0].rows[1]).toMatchObject({
      componentName: 'MOTOR 750Kg',
      quantity: '1',
      totalWeight: 60,
    });
  });

  it('rejects loads whose 20% safety margin exceeds the motor catalog', () => {
    const result = buildXmlpWeightTables({
      arrays: [makeArray({ totalMassKg: 1666.7 })],
    }, soundWeightComponents);

    expect(result.tables).toEqual([]);
    expect(result.warnings).toEqual([
      'MAIN L: ningún motor del catálogo puede soportar por sí solo 1666.7 kg con un margen del 20 %; no se importó.',
    ]);
  });

  it('does not create a silently understated table when an unweighted model is unknown', () => {
    const result = buildXmlpWeightTables({
      arrays: [makeArray({
        arrayName: 'DELAY R',
        riggingFrame: '',
        enclosures: [{ model: 'MODELO FUTURO' }],
      })],
    }, soundWeightComponents);

    expect(result.tables).toEqual([]);
    expect(result.warnings).toEqual([
      'DELAY R: sin peso XMLP y sin equivalencia segura para MODELO FUTURO; no se importó.',
    ]);
  });
});
