import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GooglePlaceAutocomplete } from '../GooglePlaceAutocomplete';
import { searchGooglePlaces } from '@/services/googlePlaceSearch';

vi.mock('@/services/googlePlaceSearch', () => ({ searchGooglePlaces: vi.fn() }));
vi.mock('@/lib/mapbox/mapboxClient', () => ({ getMapboxToken: vi.fn().mockResolvedValue(null) }));
const venue = { name: 'WiZink Center', address: 'Avenida de Felipe II, Madrid',
  place_id: 'google-venue-id', coordinates: { lat: 40.4239, lng: -3.6717 } };
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(400); });
const type = (value: string) => fireEvent.change(screen.getByRole('textbox'), { target: { value } });

beforeEach(() => { vi.useFakeTimers(); vi.mocked(searchGooglePlaces).mockReset(); });
afterEach(() => vi.useRealTimers());

describe('job venue Google search', () => {
  it('debounces name search and selects the returned address, coordinates and Google ID without another lookup', async () => {
    vi.mocked(searchGooglePlaces).mockResolvedValue([venue]);
    const onSelect = vi.fn();
    render(<GooglePlaceAutocomplete value="" onSelect={onSelect} />);
    type('Wi'); type('WiZink Center Madrid');
    expect(searchGooglePlaces).not.toHaveBeenCalled();
    await tick();
    expect(searchGooglePlaces).toHaveBeenCalledTimes(1);
    expect(searchGooglePlaces).toHaveBeenCalledWith('WiZink Center Madrid', expect.any(AbortSignal));
    fireEvent.click(screen.getByRole('button', { name: /WiZink Center/ }));
    expect(onSelect).toHaveBeenCalledWith(venue);
    expect(screen.getByRole('textbox')).toHaveValue(venue.name);
    expect(searchGooglePlaces).toHaveBeenCalledTimes(1);
  });

  it('ignores a response to an older name even during the next debounce window', async () => {
    let resolveOld!: (places: typeof venue[]) => void;
    vi.mocked(searchGooglePlaces).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce([{ ...venue, name: 'Palau Sant Jordi' }]);
    render(<GooglePlaceAutocomplete value="" onSelect={vi.fn()} />);
    type('WiZink'); await tick();
    type('Palau');
    await act(async () => { resolveOld([venue]); });
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await tick();
    expect(screen.getByRole('button', { name: /Palau Sant Jordi/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /WiZink/ })).not.toBeInTheDocument();
  });

  it('clears results immediately, cancels pending searches and releases busy state', async () => {
    vi.mocked(searchGooglePlaces).mockResolvedValue([venue]);
    const busy = vi.fn();
    const { unmount } = render(<GooglePlaceAutocomplete value="" onSelect={vi.fn()} onBusyChange={busy} />);
    type('WiZink'); await tick();
    type('');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(busy).toHaveBeenLastCalledWith(false);
    type('Palau'); unmount(); await tick();
    expect(searchGooglePlaces).toHaveBeenCalledTimes(1);
  });

  it('reuses repeat-query results and prevents Enter from submitting the job form', async () => {
    vi.mocked(searchGooglePlaces).mockResolvedValue([venue]);
    const submit = vi.fn((event) => event.preventDefault());
    render(<form onSubmit={submit}><GooglePlaceAutocomplete value="" onSelect={vi.fn()} /></form>);
    type('WiZink'); await tick(); type(''); type('WiZink'); await tick();
    expect(searchGooglePlaces).toHaveBeenCalledTimes(1);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })).toBe(false);
    expect(submit).not.toHaveBeenCalled();
  });

  it('shows a Spanish error when Google is unavailable and leaves the field editable', async () => {
    vi.mocked(searchGooglePlaces).mockRejectedValue(new Error('upstream failed'));
    const onInputChange = vi.fn();
    render(<GooglePlaceAutocomplete value="" onSelect={vi.fn()} onInputChange={onInputChange} />);
    type('WiZink'); await tick();
    expect(screen.getByRole('status')).toHaveTextContent('No se pudo buscar la ubicación');
    type('Mi recinto');
    expect(screen.getByRole('textbox')).toHaveValue('Mi recinto');
    expect(onInputChange).toHaveBeenLastCalledWith('Mi recinto');
  });
});
