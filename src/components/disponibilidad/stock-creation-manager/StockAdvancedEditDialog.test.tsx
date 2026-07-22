import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StockAdvancedEditDialog } from '@/components/disponibilidad/stock-creation-manager/StockAdvancedEditDialog';

type DialogProps = React.ComponentProps<typeof StockAdvancedEditDialog>;

function renderDialog(overrides: Partial<DialogProps> = {}) {
  const props: DialogProps = {
    open: true,
    onClose: vi.fn(),
    categories: ['pa_mains'],
    name: 'K2',
    onNameChange: vi.fn(),
    manufacturer: 'L-Acoustics',
    onManufacturerChange: vi.fn(),
    category: 'pa_mains',
    onCategoryChange: vi.fn(),
    resourceId: 'resource-1',
    onResourceIdChange: vi.fn(),
    flexUrl: 'https://example.test/flex',
    onFlexUrlChange: vi.fn(),
    imageId: 'image-1',
    onImageIdChange: vi.fn(),
    showFlexSection: false,
    onShowFlexSectionChange: vi.fn(),
    isFetchingFlex: false,
    isSaving: false,
    onPasteFlexUrl: vi.fn(),
    onFetchFlex: vi.fn(),
    onSave: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<StockAdvancedEditDialog {...props} />) };
}

describe('StockAdvancedEditDialog', () => {
  it('keeps controlled editing and save callbacks connected', async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();
    const onSave = vi.fn();

    renderDialog({ onNameChange, onSave });

    await user.clear(screen.getByLabelText('Nombre del Equipo'));
    await user.type(screen.getByLabelText('Nombre del Equipo'), 'K3');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onNameChange).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledOnce();
  });

  it('locks fields and close paths while a save is in flight', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onNameChange = vi.fn();
    const { props, rerender } = renderDialog({
      isSaving: true,
      showFlexSection: true,
      onClose,
      onNameChange,
    });

    expect(screen.getByLabelText('Nombre del Equipo')).toBeDisabled();
    expect(screen.getByLabelText('Fabricante')).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
    expect(screen.getByLabelText('Flex Resource ID')).toBeDisabled();
    expect(screen.getByPlaceholderText('Pegar URL de Flex')).toBeDisabled();
    expect(screen.getByTitle('Pegar URL')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Obtener' })).toBeDisabled();
    expect(screen.getByLabelText('Image ID')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Ocultar integración Flex' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();

    await user.keyboard('{Escape}');
    await user.type(screen.getByLabelText('Nombre del Equipo'), ' changed');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onNameChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    rerender(<StockAdvancedEditDialog {...props} isSaving={false} />);
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
