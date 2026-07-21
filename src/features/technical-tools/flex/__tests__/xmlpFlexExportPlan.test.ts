import { describe, expect, it } from 'vitest';

import type {
  NwmMap,
  SoundvisionFlysheetArray,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import {
  buildXmlpFlexExportPlan,
  calculateLaAmplifierPackaging,
  classifyXmlpArray,
  type XmlpEquipmentRow,
} from '../xmlpFlexExportPlan';
import { resolveXmlpRiggingRequirement } from '@/features/technical-tools/weights/xmlpRiggingRequirements';

const array = (
  arrayName: string,
  models: string[],
  patch: Partial<SoundvisionFlysheetArray> = {},
): SoundvisionFlysheetArray => ({
  groupName: '',
  arrayName,
  deployment: 'stacked',
  azimuthDegrees: null,
  topSiteDegrees: null,
  bottomSiteDegrees: null,
  topHeightMeters: null,
  bottomHeightMeters: null,
  riggingFrame: '',
  flyingBarSetting: '',
  pickupConfiguration: '',
  totalMassKg: null,
  frontLoadKg: null,
  rearLoadKg: null,
  enclosures: models.map((model): SoundvisionFlysheetArray['enclosures'][number] => ({
    model,
    splayAngleDegrees: null,
    siteAngleDegrees: null,
    trimHeightMeters: null,
    dispersionSetting: null,
  })),
  warnings: [],
  ...patch,
});

const map = (
  arrays: SoundvisionFlysheetArray[],
  patch: Partial<NwmMap> = {},
): NwmMap => ({
  sessionName: 'Test XMLP',
  units: [],
  groups: [],
  flysheet: { projectName: 'Test', arrays },
  ...patch,
});

const equipment = (
  name: string,
  resourceId: string | null,
  department = 'sound',
  category = 'speakers',
  id = name,
): XmlpEquipmentRow => ({ id, name, department, category, resource_id: resourceId });

describe('classifyXmlpArray', () => {
  it.each([
    ['MAIN L', ['K2'], 'pa_mains'],
    ['MAIN R', ['K2'], 'pa_mains'],
    ['MAIN C', ['K2'], 'pa_mains'],
    ['K2 L', ['K2'], 'pa_mains'],
    ['K2 R', ['K2'], 'pa_mains'],
    ['KS28 L', ['KS28'], 'pa_subs'],
    ['KS28 R', ['KS28'], 'pa_subs'],
    ['TFS900B', ['TFS900B'], 'pa_subs'],
    ['TFS550L', ['TFS550L'], 'pa_subs'],
    ['TFS600A L', ['TFS600A'], 'pa_mains'],
    ['boxes', ['K1-SB'], 'pa_subs'],
    ['OUT L', ['K2'], 'pa_outfill'],
    ['OUT R', ['K2'], 'pa_outfill'],
    ['SIDE', ['K2'], 'pa_outfill'],
    ['SIDEFILL R', ['K2'], 'pa_outfill'],
    ['FRONT', ['Kiva'], 'pa_frontfill'],
    ['FRONTS', ['Kiva'], 'pa_frontfill'],
    ['FF', ['Kiva'], 'pa_frontfill'],
    ['DELAY 1', ['Kara II'], 'pa_delays'],
    ['DELAYS', ['Kara II'], 'pa_delays'],
    ['DOWN', ['Kara II'], 'pa_downfill'],
    ['DOWNFILL', ['Kara II'], 'pa_downfill'],
  ])('%s classifies as %s', (name, models, expected) => {
    expect(classifyXmlpArray(array(name, models)).category).toBe(expected);
  });

  it('does not silently classify an unknown array as mains', () => {
    expect(classifyXmlpArray(array('Choir balcony', ['Unknown 12'])).category).toBeNull();
    expect(classifyXmlpArray(array('OUTSIDE', ['Unknown 12'])).category).toBeNull();
  });

  it('warns about mixed full-range and subwoofer enclosures', () => {
    expect(classifyXmlpArray(array('MAIN L', ['K2', 'KS28'])).warning).toMatch(/mezcla sospechosa/i);
  });

  it('treats the explicit Soundvision group as authoritative', () => {
    expect(classifyXmlpArray(array('Copy of KARA II 1', ['Kara II'], {
      groupName: 'Frontfill',
    })).category).toBe('pa_frontfill');
    expect(classifyXmlpArray(array('Copy of K1 L', ['K2'], {
      groupName: 'Sistema de PA',
    })).category).toBe('pa_mains');
  });

  it('does not mistake the preposition in Copy of for an outfill abbreviation', () => {
    expect(classifyXmlpArray(array('Copy of K1 L', ['K2'], { groupName: 'ALL' })).category)
      .toBe('pa_mains');
  });
});

describe('XMLP speaker, rigging and motor extraction', () => {
  it('preserves the explicit Main, SUB, Outfill and Frontfill totals from nested groups', () => {
    const groupedArrays = [
      array('Copy of K1 L', Array(12).fill('K2'), { groupName: 'Main' }),
      array('YZ Sym of Copy of K1 L', Array(12).fill('K2'), { groupName: 'Main' }),
      array('Sub L', Array(8).fill('KS28'), { groupName: 'SUB' }),
      array('Sub R', Array(8).fill('KS28'), { groupName: 'SUB' }),
      array('KARA II 1', Array(6).fill('Kara II'), { groupName: 'Outfill' }),
      array('KARA II 1_YZ Sym', Array(6).fill('Kara II'), { groupName: 'Outfill' }),
      ...Array.from({ length: 6 }, (_, index) =>
        array(`Frontfill ${index + 1}`, Array(2).fill('Kara II'), { groupName: 'Frontfill' })),
    ];
    const plan = buildXmlpFlexExportPlan(map(groupedArrays), [
      equipment('K2', 'resource-k2'),
      equipment('KS28', 'resource-ks28'),
      equipment('Kara II', 'resource-kara'),
    ]);
    const quantity = (groupKey: string, canonicalKey: string) =>
      plan.groups.find((group) => group.flexCategoryKey === groupKey)?.items
        .find((item) => item.canonicalKey === canonicalKey)?.quantity;

    expect(quantity('pa_mains', 'K2')).toBe(24);
    expect(quantity('pa_outfill', 'KARA II')).toBe(12);
    expect(quantity('pa_subs', 'KS28')).toBe(16);
    expect(quantity('pa_frontfill', 'KARA II')).toBe(12);
  });

  it('merges left/right quantities while retaining array traceability', () => {
    const plan = buildXmlpFlexExportPlan(
      map([array('MAIN L', Array(12).fill('K2')), array('MAIN R', Array(12).fill('K2'))]),
      [equipment('K2', 'resource-k2')],
    );
    const k2 = plan.groups.find((group) => group.flexCategoryKey === 'pa_mains')?.items
      .find((item) => item.canonicalKey === 'K2');
    expect(k2).toEqual(expect.objectContaining({ quantity: 24, resourceId: 'resource-k2' }));
    expect(k2?.sourceArrays).toEqual(['MAIN L', 'MAIN R']);
  });

  it('keeps the same model separate across Flex groups', () => {
    const plan = buildXmlpFlexExportPlan(
      map([array('MAIN L', ['K2']), array('OUT L', ['K2'])]),
      [equipment('K2', 'resource-k2')],
    );
    expect(plan.groups.find((group) => group.flexCategoryKey === 'pa_mains')?.items[0].quantity).toBe(1);
    expect(plan.groups.find((group) => group.flexCategoryKey === 'pa_outfill')?.items[0].quantity).toBe(1);
  });

  it('uses the shared rigging resolver and packages two K2 bumpers in one dual case', () => {
    const source = array('MAIN L', ['K2'], {
      riggingFrame: 'K2-BUMP',
      flyingBarSetting: '2x K2-BAR · A',
    });
    expect(resolveXmlpRiggingRequirement(source, 0)).toEqual(
      expect.objectContaining({ canonicalKey: 'BUMPER K2', quantity: 2 }),
    );
    const plan = buildXmlpFlexExportPlan(map([source]), [
      equipment('Dual K2 Rigging Flight Case', 'resource-bumper', 'lights', 'rigging'),
    ]);
    expect(plan.groups[0].items.find((item) => item.canonicalKey === 'BUMPER K2 DUAL CASE'))
      .toEqual(expect.objectContaining({ quantity: 1, resourceId: 'resource-bumper' }));
  });

  it('packages K1 bumpers into dual cases plus an odd single case', () => {
    const plan = buildXmlpFlexExportPlan(map([array('MAIN L', ['K1'], {
      riggingFrame: 'K1-BUMP',
      flyingBarSetting: '3x K1-BAR',
    })]), [
      equipment('Dual K1 Rigging Flight Case', 'resource-k1-dual', 'lights', 'rigging'),
      equipment('K1 Rigging Flight Case', 'resource-k1-single', 'lights', 'rigging'),
    ]);

    expect(plan.groups[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ canonicalKey: 'BUMPER K1 DUAL CASE', quantity: 1, resourceId: 'resource-k1-dual' }),
      expect.objectContaining({ canonicalKey: 'BUMPER K1 SINGLE CASE', quantity: 1, resourceId: 'resource-k1-single' }),
    ]));
  });

  it('rounds an odd Kara bumper count up to complete dual cases', () => {
    const plan = buildXmlpFlexExportPlan(map([array('FRONTFILL', ['Kara II'], {
      riggingFrame: 'KARA-BUMP',
      flyingBarSetting: '3x KARA-BAR',
    })]), [
      equipment('Dual Kara Rigging Flight Case', 'resource-kara-dual', 'lights', 'rigging'),
    ]);

    const frontfill = plan.groups.find((group) => group.flexCategoryKey === 'pa_frontfill');
    expect(frontfill?.items.find((item) => item.canonicalKey === 'BUMPER KARA DUAL CASE'))
      .toEqual(expect.objectContaining({ quantity: 2, resourceId: 'resource-kara-dual' }));
  });

  it('infers motors only for flown arrays with the existing 120% Pesos rule', () => {
    const flown = array('MAIN L', ['K2'], {
      deployment: 'flown',
      totalMassKg: 600,
      pickupConfiguration: 'F: 1 / R: 2',
    });
    const stacked = array('MAIN R', ['K2'], { deployment: 'stacked', totalMassKg: 600 });
    const plan = buildXmlpFlexExportPlan(map([flown, stacked]), [
      equipment(
        'Motor Elevacion ChainMaster D8+ 750kg - 24 m',
        'resource-750',
        'lights',
        'rigging',
      ),
    ]);
    const motors = plan.groups[0].items.filter((item) => item.sources.includes('pesos-motor'));
    expect(motors).toEqual([
      expect.objectContaining({ canonicalKey: 'MOTOR 750KG', quantity: 2, resourceId: 'resource-750' }),
    ]);
  });
});

describe('amplifiers, packaging and PDU derivation', () => {
  it.each([
    [0, 0, 0],
    [1, 0, 1],
    [2, 0, 2],
    [3, 1, 0],
    [4, 1, 1],
    [5, 1, 2],
    [6, 2, 0],
    [7, 2, 1],
  ])('packages %i compatible amps as %i racks and %i cases', (count, racks, cases) => {
    expect(calculateLaAmplifierPackaging(count)).toEqual({
      laRackQuantity: racks,
      laCaseQuantity: cases,
    });
  });

  it('exports compatible LA amplifiers only through their rack/case containers', () => {
    const unit = (octet: number, model: string) => ({
      octet,
      model,
      ip: `192.168.1.${octet}`,
      presetName: '',
      familyName: '',
      x: 0,
      y: 0,
    });
    const plan = buildXmlpFlexExportPlan(
      map([], {
        units: [unit(1, 'LA12X'), unit(1, 'LA12X'), unit(2, 'PLM 20000D')],
        groups: [
          { name: 'MAIN L', role: 'source', members: [1, 2] },
          { name: 'ALL', role: 'parent', members: [1, 2] },
        ],
      }),
      [],
    );
    const amps = plan.groups.find((group) => group.flexCategoryKey === 'pa_amp')!.items;
    expect(amps.some((item) => item.canonicalKey === 'LA12X')).toBe(false);
    expect(amps.find((item) => item.canonicalKey === 'PLM20000D')?.quantity).toBe(1);
    expect(amps.find((item) => item.canonicalKey === 'LA-CASE')?.quantity).toBe(1);
    expect(amps.some((item) => item.sources.includes('consumos-pdu'))).toBe(true);
  });

  it('packages 20 LA12X as 6 LA-RAK II plus 2 LA-CASE without amplifier lines', () => {
    const units = Array.from({ length: 20 }, (_, index) => ({
      octet: index + 1,
      model: 'LA12X',
      ip: `192.168.1.${index + 1}`,
      presetName: '',
      familyName: '',
      x: 0,
      y: 0,
    }));
    const plan = buildXmlpFlexExportPlan(map([], { units }), [
      equipment("L'Acoustics LA-RAK II", 'resource-la-rak', 'sound', 'amplificacion'),
      equipment("L'Acoustics LA-CASE II", 'resource-la-case', 'sound', 'amplificacion'),
    ]);
    const amps = plan.groups.find((group) => group.flexCategoryKey === 'pa_amp')!.items;

    expect(amps.some((item) => item.canonicalKey === 'LA12X')).toBe(false);
    expect(amps.find((item) => item.canonicalKey === 'LA-RAK II'))
      .toEqual(expect.objectContaining({ quantity: 6, resourceId: 'resource-la-rak' }));
    expect(amps.find((item) => item.canonicalKey === 'LA-CASE'))
      .toEqual(expect.objectContaining({ quantity: 2, resourceId: 'resource-la-case' }));
  });
});

describe('safe equipment resolution', () => {
  it('resolves the approved real KS28 speaker name and resource ID', () => {
    const plan = buildXmlpFlexExportPlan(map([array('KS28 L', ['KS28'])]), [
      equipment("L'Acoustics KS 28", 'acbd4200-4fa3-11eb-815f-2a0a4490a7fb'),
    ]);

    expect(plan.groups.find((group) => group.flexCategoryKey === 'pa_subs')?.items).toContainEqual(
      expect.objectContaining({
        canonicalKey: 'KS28',
        mappingStatus: 'mapped',
        resourceId: 'acbd4200-4fa3-11eb-815f-2a0a4490a7fb',
      }),
    );
  });

  it('does not match K2 to an unrelated lighting K20', () => {
    const plan = buildXmlpFlexExportPlan(map([array('MAIN L', ['K2'])]), [
      equipment('Clay Paky K20', 'lighting-k20', 'lights', 'robotica'),
    ]);
    expect(plan.groups[0].items.find((item) => item.canonicalKey === 'K2')).toEqual(
      expect.objectContaining({ mappingStatus: 'missing-equipment', resourceId: null }),
    );
  });

  it('reports null resource IDs and allows other mapped lines to proceed', () => {
    const plan = buildXmlpFlexExportPlan(map([array('MAIN L', ['K1', 'K2'])]), [
      equipment("L'Acoustics K1", null),
      equipment('K2', 'resource-k2'),
    ]);
    expect(plan.groups[0].items.find((item) => item.canonicalKey === 'K1')?.mappingStatus).toBe('missing-resource-id');
    expect(plan.groups[0].items.find((item) => item.canonicalKey === 'K2')?.mappingStatus).toBe('mapped');
  });

  it('fails closed when one Flex resource ID represents two canonical identities', () => {
    const plan = buildXmlpFlexExportPlan(map([array('SUB L', ['KS28'], {
      riggingFrame: 'KS28 BUMP',
    })]), [
      equipment('KS28', 'shared-resource'),
      equipment('KS28 BUMP', 'shared-resource', 'lights', 'rigging'),
    ]);
    expect(plan.groups.find((group) => group.flexCategoryKey === 'pa_subs')?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ canonicalKey: 'KS28', mappingStatus: 'ambiguous' }),
        expect.objectContaining({ canonicalKey: 'BUMPER KS28', mappingStatus: 'ambiguous' }),
      ]),
    );
  });
});
