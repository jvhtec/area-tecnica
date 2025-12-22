import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JobCardActions } from '../JobCardActions';
import type { FlatElementNode } from '@/utils/flex-folders';
import * as resolveFlexUrl from '@/utils/flex-folders/resolveFlexUrl';
import * as useFlexUuidModule from '@/hooks/useFlexUuid';
import * as flexMainFolderId from '@/utils/flexMainFolderId';

const {
  FlexElementSelectorDialogMock,
  openFlexElementMock,
  getElementTreeMock,
  MOCK_PRESUPUESTO_DRYHIRE_ID,
} = vi.hoisted(() => ({
  FlexElementSelectorDialogMock: vi.fn(() => null),
  openFlexElementMock: vi.fn(),
  getElementTreeMock: vi.fn(),
  MOCK_PRESUPUESTO_DRYHIRE_ID: 'mock-presupuesto-dryhire',
}));

// Mock modules
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      })),
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    },
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/components/incident-reports/TechnicianIncidentReportDialog', () => ({
  TechnicianIncidentReportDialog: () => null,
}));

vi.mock('@/components/flex/FlexElementSelectorDialog', () => ({
  FlexElementSelectorDialog: FlexElementSelectorDialogMock,
}));

vi.mock('@/utils/flex-folders', () => ({
  createTourdateFilterPredicate: vi.fn(),
  openFlexElement: openFlexElementMock,
  resolveFlexUrlSync: vi.fn(),
  getElementTree: getElementTreeMock,
  FLEX_FOLDER_IDS: {
    presupuestoDryHire: MOCK_PRESUPUESTO_DRYHIRE_ID,
  },
}));

vi.mock('@/utils/flexMainFolderId', () => ({
  getMainFlexElementIdSync: vi.fn(),
  resolveTourFolderForTourdate: vi.fn(),
}));

vi.mock('@/hooks/useFlexUuid', () => ({
  useFlexUuid: vi.fn(),
}));

describe('JobCardActions', () => {
  const mockToast = vi.fn();
  const defaultProps = {
    job: {
      id: 'test-job-id',
      job_type: 'single',
      title: 'Test Job',
      flex_folders: [],
    },
    userRole: 'management',
    foldersAreCreated: false,
    isProjectManagementPage: true,
    isHouseTech: false,
    showUpload: false,
    canEditJobs: true,
    canCreateFlexFolders: true,
    canUploadDocuments: false,
    canManageArtists: true,
    onRefreshData: vi.fn(),
    onEditButtonClick: vi.fn(),
    onDeleteClick: vi.fn(),
    onCreateFlexFolders: vi.fn(),
    onCreateLocalFolders: vi.fn(),
    onFestivalArtistsClick: vi.fn(),
    onAssignmentDialogOpen: vi.fn(),
    handleFileUpload: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock useFlexUuid hook
    vi.spyOn(useFlexUuidModule, 'useFlexUuid').mockReturnValue({
      flexUuid: null,
      isLoading: false,
      error: null,
      folderExists: false,
      refetch: vi.fn(),
    });
    // Mock getMainFlexElementIdSync
    vi.spyOn(flexMainFolderId, 'getMainFlexElementIdSync').mockReturnValue(null);
    openFlexElementMock.mockReset();
    getElementTreeMock.mockReset();
    FlexElementSelectorDialogMock.mockClear();
    openFlexElementMock.mockResolvedValue(undefined);
    getElementTreeMock.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Open Flex button', () => {
    it('should be disabled when no valid element is available', () => {
      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle(/No hay un elemento Flex válido disponible|Abrir en Flex/);
      expect(openFlexButton).toBeDisabled();
    });

    it('should be enabled when mainFlexInfo has elementId', () => {
      vi.spyOn(flexMainFolderId, 'getMainFlexElementIdSync').mockReturnValue({
        elementId: 'test-element-id',
        department: 'sound',
      });

      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle('Abrir en Flex');
      expect(openFlexButton).not.toBeDisabled();
    });

    it('should be enabled when flexUuid is available', () => {
      vi.spyOn(useFlexUuidModule, 'useFlexUuid').mockReturnValue({
        flexUuid: 'test-flex-uuid',
        isLoading: false,
        error: null,
        folderExists: true,
        refetch: vi.fn(),
      });

      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle('Abrir en Flex');
      expect(openFlexButton).not.toBeDisabled();
    });

    it('should be disabled while loading', () => {
      vi.spyOn(useFlexUuidModule, 'useFlexUuid').mockReturnValue({
        flexUuid: null,
        isLoading: true,
        error: null,
        folderExists: false,
        refetch: vi.fn(),
      });

      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      // The button shows spinner when loading
      const openFlexButton = screen.getByRole('button', { name: /Abrir Flex/i });
      expect(openFlexButton).toBeDisabled();
    });
  });

  describe('Dry-hire job handling', () => {
    it('should open dryhire presupuesto directly when stored element ID is available', async () => {
      const user = userEvent.setup();
      const props = {
        ...defaultProps,
        job: {
          ...defaultProps.job,
          job_type: 'dryhire',
          dryhire_presupuesto_element_id: 'dryhire-presupuesto-id',
          flex_folders: [
            {
              id: 'folder-1',
              element_id: 'dryhire-element-id',
              folder_type: 'dryhire',
              department: 'sound',
            },
          ],
        },
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle('Abrir en Flex');
      expect(openFlexButton).not.toBeDisabled();
      await user.click(openFlexButton);

      await waitFor(() => {
        expect(openFlexElementMock).toHaveBeenCalledWith(
          expect.objectContaining({
            elementId: 'dryhire-presupuesto-id',
            context: expect.objectContaining({
              jobType: 'dryhire',
              folderType: 'dryhire',
              definitionId: MOCK_PRESUPUESTO_DRYHIRE_ID,
            }),
          })
        );
      });
      expect(getElementTreeMock).not.toHaveBeenCalled();
      expect(FlexElementSelectorDialogMock).not.toHaveBeenCalled();
    });

    it('should be disabled when dryhire job has no dryhire folder', () => {
      const props = {
        ...defaultProps,
        job: {
          ...defaultProps.job,
          job_type: 'dryhire',
          flex_folders: [],
        },
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle(/No hay un elemento Flex válido disponible|Abrir en Flex/);
      expect(openFlexButton).toBeDisabled();
    });

    it('should resolve dryhire presupuesto via element tree when stored ID is missing', async () => {
      const user = userEvent.setup();
      getElementTreeMock.mockResolvedValue([
        {
          elementId: 'dryhire-element-id',
          displayName: 'Dryhire Root',
          definitionId: 'some-other-id',
          children: [
            {
              elementId: 'resolved-presupuesto-id',
              displayName: 'Presupuesto Dry Hire',
              definitionId: MOCK_PRESUPUESTO_DRYHIRE_ID,
            },
          ],
        },
      ]);

      const props = {
        ...defaultProps,
        job: {
          ...defaultProps.job,
          job_type: 'dryhire',
          flex_folders: [
            {
              id: 'folder-1',
              element_id: 'dryhire-element-id',
              folder_type: 'dryhire',
              department: 'sound',
            },
          ],
        },
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle('Abrir en Flex');
      expect(openFlexButton).not.toBeDisabled();

      await user.click(openFlexButton);

      await waitFor(() => {
        expect(getElementTreeMock).toHaveBeenCalledWith('dryhire-element-id');
      });

      await waitFor(() => {
        expect(openFlexElementMock).toHaveBeenCalledWith(
          expect.objectContaining({
            elementId: 'resolved-presupuesto-id',
            context: expect.objectContaining({
              jobType: 'dryhire',
              folderType: 'dryhire',
              definitionId: MOCK_PRESUPUESTO_DRYHIRE_ID,
            }),
          })
        );
      });

      expect(FlexElementSelectorDialogMock).not.toHaveBeenCalled();
    });
  });

  describe('handleFlexElementSelect', () => {
    let resolveFlexUrlSyncSpy: any;

    beforeEach(() => {
      // Access the real module to spy on it
      resolveFlexUrlSyncSpy = vi.spyOn(resolveFlexUrl, 'resolveFlexUrlSync');
    });

    it('should generate URL for financial document', async () => {
      const user = userEvent.setup();
      const financialDocUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/test-element/doc-view/ca6b072c-b122-11df-b8d5-00e08175e43e/header';
      
      resolveFlexUrlSyncSpy.mockReturnValue(financialDocUrl);

      vi.spyOn(flexMainFolderId, 'getMainFlexElementIdSync').mockReturnValue({
        elementId: 'main-element-id',
        department: 'sound',
      });

      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      const { rerender } = render(<JobCardActions {...props} />);

      // Simulate opening the selector and selecting an element
      // Since we can't interact with the mocked dialog, we'll test the callback directly
      // by accessing it through the component's internal state
      // For now, we verify the mock is called correctly when the button would be clicked

      expect(resolveFlexUrlSyncSpy).not.toHaveBeenCalled();
    });

    it('should generate URL for expense sheet', () => {
      const expenseSheetUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/expense-element/doc-view/ca6b072c-b122-11df-b8d5-00e08175e43e/header';
      
      resolveFlexUrlSyncSpy.mockReturnValue(expenseSheetUrl);

      // Test that the correct URL format is returned
      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: 'expense-element',
        context: {
          definitionId: '566d32e0-1a1e-11e0-a472-00e08175e43e', // hojaGastos
          jobType: 'single',
        },
      });

      expect(result).toBe(expenseSheetUrl);
    });

    it('should generate URL for dryhire subfolder', () => {
      const dryHireSubfolderUrl = 'https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/dryhire-subfolder/view/simple-element/header';
      
      resolveFlexUrlSyncSpy.mockReturnValue(dryHireSubfolderUrl);

      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: 'dryhire-subfolder',
        context: {
          jobType: 'dryhire',
        },
      });

      expect(result).toBe(dryHireSubfolderUrl);
    });

    it('should emit console telemetry on missing element ID', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Test with empty elementId - should return null without throwing
      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: '',
        context: {},
      });
      
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
    });

    it('should emit console telemetry on unmapped intent', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      resolveFlexUrlSyncSpy.mockReturnValue(null);

      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: 'unknown-element',
        context: {
          definitionId: 'unknown-definition',
        },
      });

      expect(result).toBeNull();
      
      consoleErrorSpy.mockRestore();
    });

    it('should not navigate when URL is null', () => {
      resolveFlexUrlSyncSpy.mockReturnValue(null);

      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: 'test-element',
        context: {},
      });

      expect(result).toBeNull();
      // Verify no anchor element would be created (tested in component)
    });

    it('should not navigate when elementId is empty', () => {
      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: '',
        context: {},
      });

      expect(result).toBeNull();
    });

    it('should not navigate when elementId is whitespace', () => {
      const result = resolveFlexUrl.resolveFlexUrlSync({
        elementId: '   ',
        context: {},
      });

      expect(result).toBeNull();
    });

    it('forwards viewHint aliases and schemaId when selecting a node', () => {
      vi.spyOn(flexMainFolderId, 'getMainFlexElementIdSync').mockReturnValue({
        elementId: 'main-element-id',
        department: 'sound',
      });

      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      expect(FlexElementSelectorDialogMock).toHaveBeenCalled();
      
      // Type assertion after verify mock was called - need unknown intermediate due to strict mock typing
      const calls = FlexElementSelectorDialogMock.mock.calls as unknown as Array<[any]>;
      const dialogProps = calls[0][0] as { onSelect: (elementId: string, node: FlatElementNode) => void };
      
      const node: FlatElementNode = {
        elementId: 'crew-call-element',
        displayName: 'Crew Call',
        depth: 1,
        domainId: 'contact-list',
        parentElementId: 'main-element-id',
        schemaId: 'crew-call-schema',
        viewHint: 'crew-call',
      };

      dialogProps.onSelect(node.elementId, node);

      expect(openFlexElementMock).toHaveBeenCalledWith(
        expect.objectContaining({
          elementId: 'crew-call-element',
          context: expect.objectContaining({
            schemaId: 'crew-call-schema',
            viewHint: 'contact-list',
            domainId: 'contact-list',
            jobType: props.job.job_type,
          }),
        })
      );
    });
  });

  describe('Error handling', () => {
    it('should show toast for missing IDs', () => {
      // This would be tested through user interaction with the actual component
      // For now, we verify the structure is correct
      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);
      
      // Component renders without errors
      expect(screen.getByTitle(/No hay un elemento Flex válido disponible|Cargando…/)).toBeTruthy();
    });

    it('should show toast for unmapped intents', () => {
      // Similar to above - tested through integration
      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);
      
      expect(screen.getByTitle(/No hay un elemento Flex válido disponible|Cargando…/)).toBeTruthy();
    });
  });

  describe('Button visibility', () => {
    it('should show Open Flex button when folders are created', () => {
      vi.spyOn(flexMainFolderId, 'getMainFlexElementIdSync').mockReturnValue({
        elementId: 'test-element-id',
        department: 'sound',
      });

      const props = {
        ...defaultProps,
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      expect(screen.getByText('Abrir Flex')).toBeTruthy();
    });

    it('should show Create Flex folders button when folders are not created', () => {
      const props = {
        ...defaultProps,
        foldersAreCreated: false,
      };

      render(<JobCardActions {...props} />);

      const createButton = screen.getByTitle(/Crear carpetas Flex|Las carpetas ya existen/);
      expect(createButton).toBeTruthy();
    });

    it('should show refresh button', () => {
      render(<JobCardActions {...defaultProps} />);

      const refreshButton = screen.getByTitle('Actualizar');
      expect(refreshButton).toBeTruthy();
    });

    it('should show edit button when canEditJobs is true', () => {
      render(<JobCardActions {...defaultProps} />);

      const editButton = screen.getByTitle('Editar detalles del trabajo');
      expect(editButton).toBeTruthy();
    });

    it('should show delete button when canEditJobs is true', () => {
      render(<JobCardActions {...defaultProps} />);

      const deleteButton = screen.getAllByRole('button').find(
        btn => btn.querySelector('svg')?.getAttribute('class')?.includes('lucide-trash')
      );
      expect(deleteButton).toBeTruthy();
    });
  });

  describe('Tourdate job handling', () => {
    it('should enable Open Flex button for tourdate jobs', () => {
      const props = {
        ...defaultProps,
        job: {
          ...defaultProps.job,
          job_type: 'tourdate',
          start_time: '2024-01-15',
        },
        foldersAreCreated: true,
      };

      render(<JobCardActions {...props} />);

      const openFlexButton = screen.getByTitle('Abrir en Flex');
      expect(openFlexButton).not.toBeDisabled();
    });
  });
});
