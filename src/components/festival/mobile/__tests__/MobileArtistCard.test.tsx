import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MobileArtistCard } from '../MobileArtistCard';

// Helper function to create mock artist data
const createMockArtist = (overrides = {}) => ({
  id: '1',
  name: 'Test Artist',
  stage: 1,
  show_start: '20:00',
  show_end: '22:00',
  soundcheck: false,
  foh_console: 'DiGiCo SD10',
  foh_console_provided_by: 'festival' as const,
  mon_console: 'DiGiCo SD12',
  mon_console_provided_by: 'festival' as const,
  monitors_from_foh: false,
  wireless_systems: [],
  iem_systems: [],
  monitors_enabled: true,
  monitors_quantity: 4,
  extras_sf: false,
  extras_df: false,
  extras_djbooth: false,
  rider_missing: false,
  ...overrides,
});

describe('MobileArtistCard', () => {
  const defaultProps = {
    artist: createMockArtist(),
    stageName: 'Main Stage',
    mode: 'edit' as const,
    onEditCategory: vi.fn(),
    onEditArtist: vi.fn(),
    onGenerateLink: vi.fn(),
    onManageFiles: vi.fn(),
    onPrintArtist: vi.fn(),
    onDeleteArtist: vi.fn(),
    onOpenStagePlotCapture: vi.fn(),
    onDeleteStagePlot: vi.fn(),
    printingArtistId: null,
    deletingArtistId: null,
    uploadingStagePlotArtistId: null,
    deletingStagePlotArtistId: null,
  };

  it('renders artist name and stage', () => {
    render(<MobileArtistCard {...defaultProps} />);
    expect(screen.getByText('Test Artist')).toBeInTheDocument();
    expect(screen.getByText('Main Stage')).toBeInTheDocument();
  });

  it('displays show time correctly', () => {
    render(<MobileArtistCard {...defaultProps} />);
    expect(screen.getByText(/20:00-22:00/)).toBeInTheDocument();
  });

  it('displays soundcheck time when soundcheck is true', () => {
    const artistWithSoundcheck = createMockArtist({
      soundcheck: true,
      soundcheck_start: '18:00',
      soundcheck_end: '19:00',
    });
    render(<MobileArtistCard {...defaultProps} artist={artistWithSoundcheck} />);
    expect(screen.getByText('Soundcheck')).toBeInTheDocument();
    expect(screen.getByText(/18:00-19:00/)).toBeInTheDocument();
  });

  it('shows "Completo" badge when rider is not missing', () => {
    render(<MobileArtistCard {...defaultProps} />);
    expect(screen.getByText('Completo')).toBeInTheDocument();
  });

  it('shows "Faltante" badge when rider is missing', () => {
    const artistWithMissingRider = createMockArtist({ rider_missing: true });
    render(<MobileArtistCard {...defaultProps} artist={artistWithMissingRider} />);
    expect(screen.getByText('Faltante')).toBeInTheDocument();
  });

  it('shows "Enviado" badge when artist_submitted is true', () => {
    const submittedArtist = createMockArtist({ artist_submitted: true });
    render(<MobileArtistCard {...defaultProps} artist={submittedArtist} />);
    expect(screen.getByText('Enviado')).toBeInTheDocument();
  });

  it('shows "AM" badge when isaftermidnight is true', () => {
    const afterMidnightArtist = createMockArtist({ isaftermidnight: true });
    render(<MobileArtistCard {...defaultProps} artist={afterMidnightArtist} />);
    expect(screen.getByText('AM')).toBeInTheDocument();
  });

  it('displays console setup summary', () => {
    render(<MobileArtistCard {...defaultProps} />);
    expect(screen.getByText(/FOH: DiGiCo SD10/)).toBeInTheDocument();
    expect(screen.getByText(/MON: DiGiCo SD12/)).toBeInTheDocument();
  });

  it('shows "Mon desde FOH" when monitors_from_foh is true', () => {
    const artistWithMonFromFoh = createMockArtist({
      monitors_from_foh: true,
      foh_console: 'DiGiCo SD10',
    });
    render(<MobileArtistCard {...defaultProps} artist={artistWithMonFromFoh} />);
    expect(screen.getByText(/Mon desde FOH/)).toBeInTheDocument();
  });

  it('displays wireless/IEM summary correctly', () => {
    const artistWithWireless = createMockArtist({
      wireless_systems: [
        { model: 'Shure QLX', quantity_hh: 2, quantity_bp: 1 },
      ],
      iem_systems: [
        { model: 'Shure PSM', quantity: 4 },
      ],
    });
    render(<MobileArtistCard {...defaultProps} artist={artistWithWireless} />);
    // Should show summary text
    expect(screen.getByText(/Wireless \/ IEM/)).toBeInTheDocument();
  });

  it('displays monitor summary', () => {
    render(<MobileArtistCard {...defaultProps} />);
    expect(screen.getByText(/4x Cuñas/)).toBeInTheDocument();
  });

  it('shows SF, DF, DJ extras when enabled', () => {
    const artistWithExtras = createMockArtist({
      extras_sf: true,
      extras_df: true,
      extras_djbooth: true,
    });
    render(<MobileArtistCard {...defaultProps} artist={artistWithExtras} />);
    expect(screen.getByText(/SF/)).toBeInTheDocument();
    expect(screen.getByText(/DF/)).toBeInTheDocument();
    expect(screen.getByText(/DJ/)).toBeInTheDocument();
  });

  it('displays infrastructure summary', () => {
    const artistWithInfra = createMockArtist({
      infra_cat6: true,
      infra_cat6_quantity: 2,
      infra_hma: true,
      infra_hma_quantity: 1,
    });
    render(<MobileArtistCard {...defaultProps} artist={artistWithInfra} />);
    expect(screen.getByText(/2x CAT6/)).toBeInTheDocument();
    expect(screen.getByText(/1x HMA/)).toBeInTheDocument();
  });

  it('displays notes when present', () => {
    const artistWithNotes = createMockArtist({
      notes: 'Special requirements for this artist',
    });
    render(<MobileArtistCard {...defaultProps} artist={artistWithNotes} />);
    expect(screen.getByText(/Special requirements/)).toBeInTheDocument();
  });

  it('truncates long notes', () => {
    const longNote = 'A'.repeat(100);
    const artistWithLongNote = createMockArtist({ notes: longNote });
    render(<MobileArtistCard {...defaultProps} artist={artistWithLongNote} />);
    // Should truncate at 60 characters
    const notesText = screen.getByText(/A{60}\.\.\./);
    expect(notesText).toBeInTheDocument();
  });

  it('hides action bar in readonly mode', () => {
    render(<MobileArtistCard {...defaultProps} mode="readonly" />);
    // Action buttons should not be visible
    expect(screen.queryByRole('button', { name: /link/i })).not.toBeInTheDocument();
  });

  it('shows action bar in edit mode', () => {
    render(<MobileArtistCard {...defaultProps} mode="edit" />);
    // Action buttons should be visible (they have icons, check by testing structure)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('shows loading spinner when printing', () => {
    render(<MobileArtistCard {...defaultProps} printingArtistId="1" />);
    // Should show loader icon instead of printer icon
    const loaders = screen.getAllByTestId(/loader/i);
    expect(loaders.length).toBeGreaterThan(0);
  });

  it('displays stage plot image when URL is provided', () => {
    render(
      <MobileArtistCard
        {...defaultProps}
        stagePlotUrl="https://example.com/plot.jpg"
      />
    );
    const image = screen.getByAlt(/Stage plot de Test Artist/);
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'https://example.com/plot.jpg');
  });

  it('displays gear mismatch indicator when provided', () => {
    const gearComparison = {
      mismatches: [
        {
          field: 'foh_console',
          festivalValue: 'DiGiCo SD10',
          submittedValue: 'Yamaha CL5',
        },
      ],
    };
    render(
      <MobileArtistCard {...defaultProps} gearComparison={gearComparison} />
    );
    // GearMismatchIndicator should be rendered
    expect(screen.getByText(/1/)).toBeInTheDocument();
  });

  it('shows rider files in readonly mode', () => {
    const riderFiles = [
      {
        id: 'file-1',
        file_name: 'Technical Rider.pdf',
        file_path: '/path/to/file',
      },
    ];
    render(
      <MobileArtistCard
        {...defaultProps}
        mode="readonly"
        riderFiles={riderFiles}
      />
    );
    expect(screen.getByText('Riders')).toBeInTheDocument();
    expect(screen.getByText('Technical Rider.pdf')).toBeInTheDocument();
  });

  it('shows multiple rider files count', () => {
    const riderFiles = [
      { id: 'file-1', file_name: 'Rider 1.pdf', file_path: '/path/1' },
      { id: 'file-2', file_name: 'Rider 2.pdf', file_path: '/path/2' },
      { id: 'file-3', file_name: 'Rider 3.pdf', file_path: '/path/3' },
    ];
    render(
      <MobileArtistCard
        {...defaultProps}
        mode="readonly"
        riderFiles={riderFiles}
      />
    );
    expect(screen.getByText(/3 archivos disponibles/)).toBeInTheDocument();
  });
});