import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { StockAdvancedEditDialog } from './StockAdvancedEditDialog';

describe('StockAdvancedEditDialog', () => {
  it('keeps controlled editing and save callbacks connected', async () => {
    const user = userEvent.setup();
    const onNameChange = vi.fn();
    const onSave = vi.fn();

    render(
      <StockAdvancedEditDialog
        open
        onClose={vi.fn()}
        categories={['pa_mains']}
        name="K2"
        onNameChange={onNameChange}
        manufacturer="L-Acoustics"
        onManufacturerChange={vi.fn()}
        category="pa_mains"
        onCategoryChange={vi.fn()}
        resourceId="resource-1"
        onResourceIdChange={vi.fn()}
        flexUrl=""
        onFlexUrlChange={vi.fn()}
        imageId="image-1"
        onImageIdChange={vi.fn()}
        showFlexSection={false}
        onShowFlexSectionChange={vi.fn()}
        isFetchingFlex={false}
        isSaving={false}
        onPasteFlexUrl={vi.fn()}
        onFetchFlex={vi.fn()}
        onSave={onSave}
      />,
    );

    await user.clear(screen.getByLabelText('Nombre del Equipo'));
    await user.type(screen.getByLabelText('Nombre del Equipo'), 'K3');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onNameChange).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledOnce();
  });
});
