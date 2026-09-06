import { createRequire } from 'node:module';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type ExcelJS from 'exceljs';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import canvgUnused from '../../src/stubs/canvg-unused';

const require = createRequire(import.meta.url);
const Excel = require('exceljs/dist/exceljs.bare.min.js') as typeof ExcelJS;

describe('optimized browser dependencies', () => {
  it('round-trips a styled Unicode workbook without global polyfills', async () => {
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet('Logística');
    sheet.addRow(['Técnico', 'Importe', 'Fecha']);
    sheet.addRow(['Muñoz — iluminación', 123.45, new Date('2026-09-05T12:00:00Z')]);
    sheet.getCell('B2').numFmt = '#,##0.00 "€"';
    sheet.getCell('A1').font = { bold: true };
    sheet.mergeCells('A3:C3');
    sheet.getCell('A3').value = 'Observaciones';
    const bytes = await workbook.xlsx.writeBuffer();
    const restored = new Excel.Workbook();
    await restored.xlsx.load(bytes);
    const actual = restored.getWorksheet('Logística');
    expect(actual?.getCell('A2').value).toBe('Muñoz — iluminación');
    expect(actual?.getCell('B2').value).toBe(123.45);
    expect(actual?.getCell('B2').numFmt).toBe('#,##0.00 "€"');
    expect(actual?.getCell('A1').font.bold).toBe(true);
    expect(actual?.getCell('C2').value).toEqual(new Date('2026-09-05T12:00:00Z'));
    expect(actual?.getCell('C3').value).toBe('Observaciones');
  });

  it('fails loudly if the deliberately omitted SVG renderer is invoked', () => {
    expect(() => canvgUnused.fromString()).toThrow('Remove the canvg alias');
  });

  it('has no source callers of the omitted jsPDF renderers', () => {
    const violations: string[] = [];
    function visitDirectory(directory: string) {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) {
          if (!['__tests__', 'stubs', 'legacy'].includes(entry.name)) visitDirectory(file);
        } else if (/\.[jt]sx?$/.test(file) && !/\.(test|spec)\./.test(file)) {
          const text = readFileSync(file, 'utf8');
          // Most modules cannot contain either call. Avoid parsing the entire
          // app during concurrent full-suite/build runs; include escaped names.
          if (!text.includes('html') && !text.includes('addSvgAsImage') && !text.includes('\\u')) continue;
          const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
          function visit(node: ts.Node) {
            if (ts.isCallExpression(node)) {
              const callee = node.expression;
              const name = ts.isPropertyAccessExpression(callee) ? callee.name.text
                : ts.isElementAccessExpression(callee) && ts.isStringLiteral(callee.argumentExpression)
                  ? callee.argumentExpression.text : undefined;
              if (name === 'html' || name === 'addSvgAsImage') violations.push(file);
            }
            ts.forEachChild(node, visit);
          }
          visit(source);
        }
      }
    }
    visitDirectory(join(process.cwd(), 'src'));
    expect(violations).toEqual([]);
  }, 15_000);
});
