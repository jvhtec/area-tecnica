import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type {
  SoundvisionFlysheet,
  SoundvisionFlysheetArray,
  SoundvisionFlysheetEnclosure,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import {
  classifyDispersionHighlight,
  generateSoundvisionFlysheetPdf,
  soundvisionWarningSeverity,
  translateSoundvisionWarning,
} from '@/utils/soundvisionFlysheetPdf';

const makeFlysheet = (arrayCount: number): SoundvisionFlysheet => ({
  projectName: 'Prueba de gira',
  arrays: Array.from({ length: arrayCount }, (_, arrayIndex): SoundvisionFlysheetArray => ({
    groupName: 'PA principal',
    arrayName: `MAIN ${arrayIndex + 1}`,
    deployment: 'flown',
    azimuthDegrees: arrayIndex * 10,
    topSiteDegrees: -2.5,
    bottomSiteDegrees: -20,
    topHeightMeters: 10,
    bottomHeightMeters: 4.2,
    riggingFrame: 'K2-BUMP',
    flyingBarSetting: 'Orificio A',
    pickupConfiguration: 'F: 5 / R: 21',
    totalMassKg: 1180.6,
    frontLoadKg: null,
    rearLoadKg: null,
    enclosures: Array.from(
      { length: 12 },
      (_, enclosureIndex): SoundvisionFlysheetEnclosure => ({
      model: 'K2',
      splayAngleDegrees: enclosureIndex < 2 ? 5 : 0.25,
      siteAngleDegrees: -2.5 - enclosureIndex,
      trimHeightMeters: 10 - enclosureIndex * 0.45,
      dispersionSetting: '55/55',
      }),
    ),
    warnings: arrayIndex === 0 ? ['Tipping hazard'] : [],
  })),
});

describe('generateSoundvisionFlysheetPdf', () => {
  it('creates one A3 landscape page per five arrays', async () => {
    const blob = await generateSoundvisionFlysheetPdf(makeFlysheet(6), {
      sourceFileName: 'prueba.xmlp',
      generatedAt: new Date('2026-07-19T12:00:00Z'),
      brandLogoDataUrl: null,
    });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());

    expect(blob.type).toBe('application/pdf');
    expect(pdf.getPageCount()).toBe(2);
    const firstPage = pdf.getPage(0).getSize();
    expect(firstPage.width).toBeGreaterThan(firstPage.height);
    expect(firstPage.width).toBeGreaterThan(1_000);
  });

  it('continues long enclosure lists without overflowing the page', async () => {
    const flysheet = makeFlysheet(1);
    flysheet.arrays[0].enclosures = Array.from(
      { length: 31 },
      (_, index): SoundvisionFlysheetEnclosure => ({
        model: `K2 ${index + 1}`,
        splayAngleDegrees: 0.25,
        siteAngleDegrees: null,
        trimHeightMeters: null,
        dispersionSetting: index % 2 === 0 ? '55/35' : null,
      }),
    );

    const blob = await generateSoundvisionFlysheetPdf(flysheet, {
      sourceFileName: 'array-largo.xmlp',
      generatedAt: new Date('2026-07-19T10:00:00Z'),
      brandLogoDataUrl: null,
    });
    const pdf = await PDFDocument.load(await blob.arrayBuffer());

    expect(pdf.getPageCount()).toBe(2);
  });

  it('refuses to generate an empty deployment sheet', async () => {
    await expect(
      generateSoundvisionFlysheetPdf({ projectName: 'Vacío', arrays: [] }, {
        sourceFileName: 'vacio.xmlp',
      }),
    ).rejects.toThrow('no contiene arrays compatibles');
  });
});

describe('translateSoundvisionWarning', () => {
  it('translates common Soundvision mechanical warnings into Spanish', () => {
    expect(translateSoundvisionWarning('Tipping hazard')).toBe('Riesgo de vuelco.');
    expect(translateSoundvisionWarning('Maximum limit is 9 KARA II.')).toBe(
      'El límite máximo es 9 KARA II.',
    );
  });

  it('preserves unknown messages instead of inventing a translation', () => {
    expect(translateSoundvisionWarning('Custom engineering note')).toBe(
      'Custom engineering note',
    );
  });

  it('assigns Spanish safety headings matching the known warning severity', () => {
    expect(
      soundvisionWarningSeverity('Safety factor is below minimum recommended by applicable standards.'),
    ).toBe('danger');
    expect(soundvisionWarningSeverity('Tipping hazard')).toBe('warning');
    expect(soundvisionWarningSeverity('Site angle is impossible.')).toBe('caution');
  });
});

describe('classifyDispersionHighlight', () => {
  it('flags a narrower-but-still-symmetric setting as "symmetric"', () => {
    expect(classifyDispersionHighlight('35/35')).toBe('symmetric');
    expect(classifyDispersionHighlight('45/45')).toBe('symmetric');
  });

  it('distinguishes which side is wider on an asymmetric setting, since 55/35 and 35/55 are mirror images', () => {
    expect(classifyDispersionHighlight('55/35')).toBe('wideLeft');
    expect(classifyDispersionHighlight('35/55')).toBe('wideRight');
    expect(classifyDispersionHighlight('60/45')).toBe('wideLeft');
    expect(classifyDispersionHighlight('45/60')).toBe('wideRight');
  });

  it('does not flag the default 55/55, a fixed-directivity box, or an unparsable value', () => {
    expect(classifyDispersionHighlight('55/55')).toBeNull();
    expect(classifyDispersionHighlight(' 55/55 ')).toBeNull();
    expect(classifyDispersionHighlight(null)).toBeNull();
    expect(classifyDispersionHighlight(undefined)).toBeNull();
    expect(classifyDispersionHighlight('')).toBeNull();
    expect(classifyDispersionHighlight('not-a-setting')).toBeNull();
  });
});
