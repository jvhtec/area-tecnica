import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type {
  SoundvisionFlysheet,
  SoundvisionFlysheetArray,
  SoundvisionFlysheetEnclosure,
} from '@/components/sound/amplifier-tool/rack-designer/nwm-import';
import {
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
