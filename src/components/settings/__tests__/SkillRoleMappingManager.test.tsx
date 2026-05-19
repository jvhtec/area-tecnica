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
    from: (...args: any[]) => fromMock(...args),
  },
}))

vi.mock('@/hooks/useOptimizedAuth', () => ({
  useOptimizedAuth: (...args: any[]) => useOptimizedAuthMock(...args),
}))

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
  toast: (...args: any[]) => toastMock(...args),
}))

import { SkillRoleMappingManager } from '../SkillRoleMappingManager'

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

function createQueryBuilder(table: string, state: { skills: SkillRow[]; mappings: MappingRow[] }) {
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
}: {
  skills?: SkillRow[]
  mappings?: MappingRow[]
  userRole?: string
  userDepartment?: string
} = {}) {
  const state = {
    skills: [...skills],
    mappings: [...mappings],
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

    await user.type(screen.getByLabelText(/^Name$/), 'RF coordination')
    await user.click(screen.getByRole('button', { name: /create/i }))

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

  it('adds a mapping with the default primary weight', async () => {
    const user = userEvent.setup()
    const { state } = setup({
      skills: [{ id: 'skill-foh', name: 'foh', category: 'sound', active: true, created_at: createdAt }],
      userRole: 'management',
      userDepartment: 'sound',
    })

    await screen.findByText('SND-FOH')
    const addButton = screen.getByRole('button', { name: /add mapping/i })
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
    await user.click(screen.getByRole('button', { name: /remove snd-foh foh mapping/i }))

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
    expect(within(mappingPanel as HTMLElement).getByText('Read only')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove lgt-dim dimmer mapping/i })).toBeDisabled()
  })
})
