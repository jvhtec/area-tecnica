// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { XmlpWeightImportButton } from '@/features/technical-tools/weights/XmlpWeightImportButton';

describe('XmlpWeightImportButton', () => {
  it('selects XMLP files and exposes progress in Spanish', () => {
    const onImport = vi.fn();
    const { container, rerender } = render(
      <XmlpWeightImportButton isImporting={false} onImport={onImport} />,
    );
    const file = new File(['encrypted'], 'gira.xmlp', { type: 'application/octet-stream' });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });
    expect(onImport).toHaveBeenCalledWith(file);

    rerender(<XmlpWeightImportButton isImporting onImport={onImport} />);
    expect(screen.getByRole('button', { name: 'Extrayendo XMLP…' })).toBeDisabled();
  });
});
