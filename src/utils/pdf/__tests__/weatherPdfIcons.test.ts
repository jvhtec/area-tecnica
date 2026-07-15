import type { jsPDF } from 'jspdf';
import type { CellHookData } from 'jspdf-autotable';
import { describe, expect, it, vi } from 'vitest';

import {
  createWeatherTableIconHooks,
  drawWeatherPdfIcon,
  resolveWeatherPdfIconKind,
} from '@/utils/pdf/weatherPdfIcons';

const createPdfMock = () => ({
  saveGraphicsState: vi.fn(),
  restoreGraphicsState: vi.fn(),
  setDrawColor: vi.fn(),
  setFillColor: vi.fn(),
  setLineWidth: vi.fn(),
  setLineCap: vi.fn(),
  circle: vi.fn(),
  line: vi.fn(),
  roundedRect: vi.fn(),
  triangle: vi.fn(),
  text: vi.fn(),
});

describe('weather PDF icons', () => {
  it.each([
    [0, 'sun'],
    [2, 'partly-cloudy'],
    [3, 'cloud'],
    [45, 'fog'],
    [51, 'drizzle'],
    [65, 'rain'],
    [73, 'snow'],
    [95, 'storm'],
  ] as const)('maps Open-Meteo code %s to %s', (weatherCode, expected) => {
    expect(resolveWeatherPdfIconKind({ weatherCode })).toBe(expected);
  });

  it('falls back to the saved condition when legacy weather data has no code', () => {
    expect(resolveWeatherPdfIconKind({ condition: 'Niebla con escarcha' })).toBe('fog');
    expect(resolveWeatherPdfIconKind({ condition: 'Tormenta con granizo' })).toBe('storm');
  });

  it('draws vector paths without sending the emoji through jsPDF text rendering', () => {
    const pdf = createPdfMock();

    drawWeatherPdfIcon(pdf as unknown as jsPDF, { weatherCode: 95 }, 10, 20, 8);

    expect(pdf.saveGraphicsState).toHaveBeenCalledOnce();
    expect(pdf.line).toHaveBeenCalled();
    expect(pdf.restoreGraphicsState).toHaveBeenCalledOnce();
    expect(pdf.text).not.toHaveBeenCalled();
  });

  it('reserves room and draws the matching icon in an AutoTable condition cell', () => {
    const pdf = createPdfMock();
    const hooks = createWeatherTableIconHooks(
      pdf as unknown as jsPDF,
      [{ weatherCode: 0 }, { weatherCode: 61 }],
    );
    const hookData = {
      section: 'body',
      column: { index: 1 },
      row: { index: 1 },
      cell: {
        x: 30,
        y: 40,
        width: 60,
        height: 12,
        styles: { cellPadding: 3 },
      },
    } as unknown as CellHookData;

    hooks.didParseCell?.(hookData);
    hooks.didDrawCell?.(hookData);

    expect(hookData.cell.styles.cellPadding).toEqual({
      top: 3,
      right: 3,
      bottom: 3,
      left: 11,
    });
    expect(pdf.circle).toHaveBeenCalled();
    expect(pdf.line).toHaveBeenCalled();
  });
});
