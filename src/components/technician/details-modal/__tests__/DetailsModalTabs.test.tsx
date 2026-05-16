// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { DocumentsTab, InfoTab, RestaurantsTab, WeatherTab } from "@/components/technician/details-modal/DetailsModalTabs";
import type { DetailsModalViewModel } from "@/components/technician/details-modal/useDetailsModalData";
import { renderWithProviders } from "@/test/renderWithProviders";

const theme = {
  bg: "bg-slate-950",
  nav: "bg-slate-900",
  card: "bg-slate-900",
  textMain: "text-white",
  textMuted: "text-slate-400",
  accent: "bg-blue-600",
  input: "bg-slate-800",
  modalOverlay: "bg-black/70",
  divider: "border-slate-800",
  danger: "text-red-500",
  success: "text-green-500",
  warning: "text-yellow-500",
  cluster: "bg-white text-black",
} as const;

const createVm = (overrides: Partial<DetailsModalViewModel> = {}) => ({
  allAssignedDates: [],
  artistNameMap: new Map(),
  artistStageMap: new Map(),
  canUploadTourDocuments: false,
  dateTypeMap: new Map(),
  documentLoading: new Set<string>(),
  eventDatesString: "2026-05-16",
  fetchWeather: vi.fn(),
  festivalStageNameMap: new Map(),
  getRoomOccupantsLabel: vi.fn(() => "Alex Manager · Bea Tech"),
  handleDownload: vi.fn(),
  handleDownloadRider: vi.fn(),
  handleDownloadTourDocument: vi.fn(),
  handleOpenAddressInMaps: vi.fn(),
  handleTourDocumentUploadSuccess: vi.fn(),
  handleViewDocument: vi.fn(),
  handleViewRider: vi.fn(),
  handleViewTourDocument: vi.fn(),
  hasHojaAccommodationData: false,
  hojaAccommodations: [],
  hojaAccommodationsLoading: false,
  hojaDeRutaLoading: false,
  isArtistsLoading: false,
  isDark: true,
  isRidersLoading: false,
  isUploadingTourDocument: false,
  isWeatherLoading: false,
  job: {
    id: "job-1",
    title: "Technician Job",
    description: "A careful setup",
    start_time: "2026-05-16T10:00:00Z",
    end_time: "2026-05-16T12:00:00Z",
    created_at: "2026-05-01T00:00:00Z",
    job_type: "tourdate",
    location: { id: "loc-1", name: "Venue" },
    job_documents: [],
  },
  jobArtists: [],
  jobArtistsError: null,
  jobDateTypesLoading: false,
  jobEndDate: "16 de mayo de 2026 a las 12:00",
  jobStartDate: "16 de mayo de 2026 a las 10:00",
  riderFiles: [],
  riderFilesError: null,
  roomOccupantsLoading: false,
  roomStaffIds: [],
  setIsUploadingTourDocument: vi.fn(),
  techShiftAssignmentsByDate: new Map(),
  techShiftAssignmentsLoading: false,
  theme,
  tourDocuments: [],
  tourDocumentsLoading: false,
  tourId: undefined,
  user: { id: "tech-1" },
  weatherData: undefined,
  weatherError: null,
  weatherVenue: {
    address: "Gran Via 1",
    coordinates: {
      lat: 40.4168,
      lng: -3.7038,
    },
  },
  ...overrides,
}) as unknown as DetailsModalViewModel;

describe("DetailsModal tabs", () => {
  it("renders assigned dates, shift detail, accommodation, and job basics in the info tab", () => {
    const vm = createVm({
      allAssignedDates: ["2026-05-16"],
      dateTypeMap: new Map([["2026-05-16", "setup"]]),
      festivalStageNameMap: new Map([[1, "Main Stage"]]),
      hasHojaAccommodationData: true,
      hojaAccommodations: [
        {
          id: "hotel-1",
          hotel_name: "Hotel Central",
          address: "Gran Via 1",
          check_in: "2026-05-15T15:00:00Z",
          check_out: "2026-05-17T10:00:00Z",
          hoja_de_ruta_room_assignments: [
            {
              id: "room-1",
              room_type: "double",
              room_number: "204",
              staff_member1_id: "tech-1",
              staff_member2_id: "tech-2",
            },
          ],
        },
      ],
      roomStaffIds: ["tech-1", "tech-2"],
      techShiftAssignmentsByDate: new Map([
        [
          "2026-05-16",
          [
            {
              assignment_id: "shift-assignment-1",
              role: "foh",
              shift: {
                id: "shift-1",
                job_id: "job-1",
                date: "2026-05-16",
                name: "Soundcheck",
                start_time: "09:30:00",
                end_time: "11:00:00",
                stage: 1,
                department: "sound",
              },
            },
          ],
        ],
      ]),
    });

    renderWithProviders(<InfoTab vm={vm} />);

    expect(screen.getByText("Technician Job")).toBeInTheDocument();
    expect(screen.getByText("Fecha de gira")).toBeInTheDocument();
    expect(screen.getByText("Montaje")).toBeInTheDocument();
    expect(screen.getByText("Soundcheck")).toBeInTheDocument();
    expect(screen.getByText("09:30 - 11:00")).toBeInTheDocument();
    expect(screen.getByText("Main Stage")).toBeInTheDocument();
    expect(screen.getByText("Hotel Central")).toBeInTheDocument();
    expect(screen.getByText("Doble · 204")).toBeInTheDocument();
    expect(screen.getByText("Alex Manager · Bea Tech")).toBeInTheDocument();
  });

  it("renders only technician-visible job docs plus rider and tour docs", () => {
    const vm = createVm({
      artistNameMap: new Map([["artist-1", "Artist One"]]),
      artistStageMap: new Map([["artist-1", 2]]),
      festivalStageNameMap: new Map([[2, "Second Stage"]]),
      job: {
        id: "job-1",
        title: "Technician Job",
        start_time: "2026-05-16T10:00:00Z",
        end_time: "2026-05-16T12:00:00Z",
        created_at: "2026-05-01T00:00:00Z",
        job_type: "tourdate",
        job_documents: [
          {
            id: "visible-doc",
            file_name: "Visible plan.pdf",
            file_path: "sound/visible.pdf",
            uploaded_at: "2026-05-01T00:00:00Z",
            visible_to_tech: true,
          },
          {
            id: "hidden-doc",
            file_name: "Hidden plan.pdf",
            file_path: "sound/hidden.pdf",
            uploaded_at: "2026-05-01T00:00:00Z",
            visible_to_tech: false,
          },
        ],
      },
      jobArtists: [{ id: "artist-1", name: "Artist One", stage: 2 }],
      riderFiles: [
        {
          id: "rider-1",
          file_name: "Artist rider.pdf",
          file_path: "artist/rider.pdf",
          uploaded_at: "2026-05-01T00:00:00Z",
          artist_id: "artist-1",
        },
      ],
      tourDocuments: [
        {
          id: "tour-doc-1",
          tour_id: "tour-1",
          file_name: "Tour book.pdf",
          file_path: "tour/book.pdf",
          uploaded_at: "2026-05-01T00:00:00Z",
          visible_to_tech: true,
        },
      ],
      tourId: "tour-1",
    });

    renderWithProviders(<DocumentsTab vm={vm} />);

    expect(screen.getByText("Visible plan.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Hidden plan.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("Artist rider.pdf")).toBeInTheDocument();
    expect(screen.getByText(/Artista:/)).toBeInTheDocument();
    expect(screen.getByText(/Artist One/)).toBeInTheDocument();
    expect(screen.getByText("Second Stage")).toBeInTheDocument();
    expect(screen.getByText("Tour book.pdf")).toBeInTheDocument();
  });

  it("renders restaurant website links only for safe http urls", () => {
    const vm = createVm({
      isRestaurantsLoading: false,
      jobDetails: {
        id: "job-1",
        title: "Technician Job",
        start_time: "2026-05-16T10:00:00Z",
        end_time: "2026-05-16T12:00:00Z",
        created_at: "2026-05-01T00:00:00Z",
        job_type: "tourdate",
        locations: {
          id: "loc-1",
          name: "Venue",
          formatted_address: "Gran Via 1",
          latitude: 40.4168,
          longitude: -3.7038,
        },
      },
      jobDetailsLoading: false,
      restaurants: [
        {
          id: "safe-restaurant",
          name: "Safe Restaurant",
          address: "Gran Via 2",
          rating: 4.5,
          priceLevel: 1,
          distance: 150,
          phone: "+34911111111",
          website: "https://safe.example",
          googlePlaceId: "place-safe",
        },
        {
          id: "unsafe-restaurant",
          name: "Unsafe Restaurant",
          address: "Gran Via 3",
          rating: 4.1,
          priceLevel: 2,
          distance: 300,
          website: "javascript:alert(1)",
          googlePlaceId: "place-unsafe",
        },
      ],
    });

    const { container } = renderWithProviders(<RestaurantsTab vm={vm} />);

    expect(screen.getByText("Safe Restaurant")).toBeInTheDocument();
    expect(screen.getByText("Unsafe Restaurant")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Llamar a Safe Restaurant" })).toHaveAttribute("href", "tel:+34911111111");
    expect(screen.getByRole("link", { name: "Abrir sitio web de Safe Restaurant" })).toHaveAttribute("href", "https://safe.example/");
    expect(container.querySelector('a[href="https://safe.example/"]')).toBeInTheDocument();
    expect(container.querySelector('a[href^="javascript:"]')).not.toBeInTheDocument();
  });

  it("shows weather refresh controls when the venue only has coordinates", () => {
    const fetchWeather = vi.fn();
    const vm = createVm({
      eventDatesString: "2026-05-16",
      fetchWeather,
      jobDetailsLoading: false,
      weatherData: [
        {
          date: "2026-05-16",
          condition: "Clouds",
          icon: "cloud",
          maxTemp: 22,
          minTemp: 15,
          precipitationProbability: 10,
          weatherCode: 3,
        },
      ],
      weatherVenue: {
        address: undefined,
        coordinates: {
          lat: 40.4168,
          lng: -3.7038,
        },
      },
    });

    renderWithProviders(<WeatherTab vm={vm} />);

    expect(screen.getByRole("button", { name: "Actualizar" })).toBeInTheDocument();
    expect(screen.queryByText("El pronóstico del tiempo requiere ubicación del lugar")).not.toBeInTheDocument();
  });
});
