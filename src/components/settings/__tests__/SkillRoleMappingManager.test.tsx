// @vitest-environment jsdom
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { renderWithProviders } from '@/test/renderWithProviders'

const {
  fromMock,
  toastMock,
  useOptimizedAuthMock,
} = vi.hoisted(() => ({
  fromMock: vi.fn(),
  toastMock: vi.fn(),
  useOptimizedAuthMock: vi.fn(),
}))

vi.mock('@/services/dataLayerClient', () => ({
  dataLayerClient: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}))

vi.mock('@/hooks/useOptimizedAuth', () => ({
  useOptimizedAuth: (...args: unknown[]) => useOptimizedAuthMock(...args),
}))

vi.mock('@/hooks/realtime/useSkillCatalogRealtime', () => ({
  useSkillCatalogRealtime: vi.fn(),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: (...args: unknown[]) => toastMock(...args),
}))

import { SkillRoleMappingManager } from '@/components/settings/SkillRoleMappingManager'
import { ACTIVE_SKILLS_QUERY_KEY } from '@/hooks/useActiveSkills'

type SkillRow = {
  id: string
  name: string
  category: string | null
  active: boolean
  created_at: string
}

type MappingRow = {
  id: string
  role_prefix: string
  skill_name: string
  weight: number
  created_at: string
}

type QueryResult = {
  data: SkillRow[] | MappingRow[] | null
  error: unknown | null
}

const createdAt = '2026-05-19T10:00:00.000Z'

type CatalogState = { skills: SkillRow[]; mappings: MappingRow[]; insertError?: unknown }

function createQueryBuilder(table: string, state: CatalogState) {
  const filters: Array<[string, unknown]> = []
  let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
  let payload: any = null

  const builder: any = {
    select: vi.fn(() => {
      operation = 'select'
      return builder
    }),
    insert: vi.fn((nextPayload: any) => {
      operation = 'insert'
      payload = nextPayload
      return builder
    }),
    update: vi.fn((nextPayload: any) => {
      operation = 'update'
      payload = nextPayload
      return builder
    }),
    delete: vi.fn(() => {
      operation = 'delete'
      return builder
    }),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value])
      return builder
    }),
    order: vi.fn(() => builder),
  }

  const run = (): QueryResult => {
    if (table === 'skills') {
      if (operation === 'insert') {
        if (state.insertError) return { data: null, error: state.insertError }
        state.skills.push({
          id: `skill-${state.skills.length + 1}`,
          name: payload.name,
          category: payload.category,
          active: payload.active,
          created_at: createdAt,
        })
        return { data: null, error: null }
      }

      if (operation === 'update') {
        const id = filters.find(([column]) => column === 'id')?.[1]
        state.skills = state.skills.map((skill) =>
          skill.id === id ? { ...skill, ...payload } : skill,
        )
        return { data: null, error: null }
      }

      return { data: state.skills, error: null }
    }

    if (table === 'role_skill_mapping') {
      if (operation === 'insert') {
        state.mappings.push({
          id: `mapping-${state.mappings.length + 1}`,
          role_prefix: payload.role_prefix,
          skill_name: payload.skill_name,
          weight: payload.weight,
          created_at: createdAt,
        })
        return { data: null, error: null }
      }

      if (operation === 'update') {
        const id = filters.find(([column]) => column === 'id')?.[1]
        state.mappings = state.mappings.map((mapping) =>
          mapping.id === id ? { ...mapping, ...payload } : mapping,
        )
        return { data: null, error: null }
      }

      if (operation === 'delete') {
        const id = filters.find(([column]) => column === 'id')?.[1]
        state.mappings = state.mappings.filter((mapping) => mapping.id !== id)
        return { data: null, error: null }
      }

      return { data: state.mappings, error: null }
    }

    return { data: null, error: null }
  }

  builder.then = (
    onFulfilled?: ((value: unknown) => unknown) | null,
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(run()).then(onFulfilled, onRejected)

  builder.catch = (
    onRejected?: ((reason: unknown) => unknown) | null,
  ) => Promise.resolve(run()).catch(onRejected)

  return builder
}

function setup({
  skills = [
    { id: 'skill-foh', name: 'foh', category: 'sound', active: true, created_at: createdAt },
    { id: 'skill-dimmer', name: 'dimmer', category: 'lights', active: true, created_at: createdAt },
  ],
  mappings = [],
  userRole = 'admin',
  userDepartment = 'sound',
  insertError,
}: {
  skills?: SkillRow[]
  mappings?: MappingRow[]
  userRole?: string
  userDepartment?: string
  insertError?: unknown
} = {}) {
  const state: CatalogState = {
    skills: [...skills],
    mappings: [...mappings],
    insertError,
  }

  useOptimizedAuthMock.mockReturnValue({
    userRole,
    userDepartment,
  })
  fromMock.mockImplementation((table: string) => createQueryBuilder(table, state))

  return {
    state,
    ...renderWithProviders(<SkillRoleMappingManager />),
  }
}

describe('SkillRoleMappingManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a skill', async () => {
    const user = userEvent.setup()
    const { state } = setup({ skills: [], userRole: 'admin' })

    await user.type(screen.getByLabelText(/^Nombre$/), 'RF coordination')
    await user.click(screen.getByRole('button', { name: /crear/i }))

    await waitFor(() => {
      expect(state.skills).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'rf coordination',
            category: 'general',
            active: true,
          }),
        ]),
      )
    })
  })

  it('refreshes the shared active catalog (matrix filter, profile picker) after creating a skill', async () => {
    const user = userEvent.setup()
    const { queryClient } = setup({ skills: [], userRole: 'management', userDepartment: 'lights' })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    await user.type(screen.getByLabelText(/^Nombre$/), 'Cañón')
    await user.click(screen.getByRole('button', { name: /crear/i }))

    await waitFor(() => expect(toastMock).toHaveBeenCalledWith({ title: 'Habilidad creada' }))
    // TanStack invalidation is by prefix: the catalog key covers the active list.
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys.some((key) => Array.isArray(key)
      && key.every((part, index) => ACTIVE_SKILLS_QUERY_KEY[index] === part))).toBe(true)
  })

  it('rejects a name that already exists in another case without inserting', async () => {
    const user = userEvent.setup()
    const { state } = setup({ userRole: 'admin' })
    await screen.findByLabelText('foh nombre de habilidad')

    await user.type(screen.getByLabelText(/^Nombre$/), ' FOH ')
    await user.click(screen.getByRole('button', { name: /crear/i }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
        title: 'No se pudo crear la habilidad',
        description: 'Ya existe una habilidad con ese nombre.',
      }))
    })
    expect(state.skills.filter((skill) => skill.name === 'foh')).toHaveLength(1)
  })

  it('explains a server rejection in Spanish', async () => {
    const user = userEvent.setup()
    setup({
      skills: [],
      userRole: 'admin',
      insertError: { code: '42501', message: 'new row violates row-level security policy for table "skills"' },
    })

    await user.type(screen.getByLabelText(/^Nombre$/), 'cañón')
    await user.click(screen.getByRole('button', { name: /crear/i }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
        description: 'No puedes gestionar habilidades en esa categoría.',
      }))
    })
  })

  it('adds a mapping with the default primary weight', async () => {
    const user = userEvent.setup()
    const { state } = setup({
      skills: [{ id: 'skill-foh', name: 'foh', category: 'sound', active: true, created_at: createdAt }],
      userRole: 'management',
      userDepartment: 'sound',
    })

    await screen.findByText('SND-FOH')
    const addButton = screen.getByRole('button', { name: /agregar mapeo/i })
    await waitFor(() => expect(addButton).toBeEnabled())
    await user.click(addButton)

    await waitFor(() => {
      expect(state.mappings).toEqual([
        expect.objectContaining({
          role_prefix: 'SND-FOH',
          skill_name: 'foh',
          weight: 1,
        }),
      ])
    })
  })

  it('removes a mapping', async () => {
    const user = userEvent.setup()
    const { state } = setup({
      skills: [{ id: 'skill-foh', name: 'foh', category: 'sound', active: true, created_at: createdAt }],
      mappings: [{
        id: 'mapping-foh',
        role_prefix: 'SND-FOH',
        skill_name: 'foh',
        weight: 1,
        created_at: createdAt,
      }],
      userRole: 'admin',
    })

    await screen.findByText('foh')
    await user.click(screen.getByRole('button', { name: /eliminar mapeo snd-foh foh/i }))

    await waitFor(() => {
      expect(state.mappings).toHaveLength(0)
    })
  })

  it('prevents a department-scoped manager from editing another department mapping', async () => {
    setup({
      mappings: [{
        id: 'mapping-dimmer',
        role_prefix: 'LGT-DIM',
        skill_name: 'dimmer',
        weight: 1,
        created_at: createdAt,
      }],
      userRole: 'management',
      userDepartment: 'sound',
    })

    await screen.findByText('dimmer')
    const lightMapping = screen.getByText('LGT-DIM')
    const mappingPanel = lightMapping.closest('.rounded-md')
    expect(mappingPanel).not.toBeNull()
    expect(within(mappingPanel as HTMLElement).getByText('Solo lectura')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /eliminar mapeo lgt-dim dimmer/i })).toBeDisabled()
  })
})
