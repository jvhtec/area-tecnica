import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Plus, Save, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth'
import { queryKeys } from '@/lib/react-query'
import { dataLayerClient } from '@/services/dataLayerClient'
import { DEPARTMENT_LABELS, TECHNICAL_DEPARTMENTS, type TechnicalDepartment } from '@/types/department'
import { roleOptionsForDiscipline } from '@/types/roles'

type Skill = {
  id: string
  name: string
  category: string | null
  active: boolean
  created_at?: string | null
}

type RoleSkillMapping = {
  id: string
  role_prefix: string
  skill_name: string
  weight: number
  created_at?: string | null
}

type RolePrefixOption = {
  prefix: string
  department: TechnicalDepartment
  label: string
}

type SkillDraft = {
  name: string
  category: string
  active: boolean
}

const EMPTY_SKILLS: Skill[] = []
const EMPTY_ROLE_SKILL_MAPPINGS: RoleSkillMapping[] = []
const SKILLS_QUERY_KEY = queryKeys.scope('skill_catalog')
const ROLE_MAPPINGS_QUERY_KEY = queryKeys.scope('role_skill_mappings')

const ROLE_PREFIX_DEPARTMENTS: Record<string, TechnicalDepartment> = {
  SND: 'sound',
  LGT: 'lights',
  VID: 'video',
  PROD: 'production',
}

export const WEIGHT_PRESETS = [
  { label: 'Principal', value: 1 },
  { label: 'Relacionada', value: 0.6 },
  { label: 'Bono', value: 0.3 },
] as const

const BASE_CATEGORY_OPTIONS = [
  'general',
  'sound',
  'sound-specialty',
  'lights',
  'lights-specialty',
  'video',
  'video-specialty',
  'production',
  'production-specialty',
  'logistics',
]

const normalizeDepartment = (value: string | null | undefined): string =>
  (value ?? '').trim().toLowerCase()

const normalizeCategory = (value: string | null | undefined): string =>
  (value ?? 'general').trim().toLowerCase() || 'general'

export const normalizeSkillName = (value: string): string =>
  value.trim().toLowerCase()

export const rolePrefixFromCode = (roleCode: string): string =>
  roleCode.replace(/-[RET]$/, '')

export const departmentForRolePrefix = (rolePrefix: string): TechnicalDepartment | null => {
  const code = rolePrefix.trim().toUpperCase().split('-')[0]
  return ROLE_PREFIX_DEPARTMENTS[code] ?? null
}

export const canManageSkillCategory = (
  category: string | null | undefined,
  userRole: string | null | undefined,
  userDepartment: string | null | undefined,
): boolean => {
  if (userRole === 'admin') return true
  if (userRole !== 'management') return false

  const department = normalizeDepartment(userDepartment)
  const normalizedCategory = normalizeCategory(category)
  if (!department) return false

  return normalizedCategory === 'general'
    || normalizedCategory === department
    || normalizedCategory.startsWith(`${department}-`)
    || normalizedCategory.startsWith(`${department}_`)
}

export const canManageRolePrefix = (
  rolePrefix: string,
  userRole: string | null | undefined,
  userDepartment: string | null | undefined,
): boolean => {
  if (userRole === 'admin') return true
  if (userRole !== 'management') return false

  const mappingDepartment = departmentForRolePrefix(rolePrefix)
  return Boolean(mappingDepartment && mappingDepartment === normalizeDepartment(userDepartment))
}

const rolePositionLabel = (label: string) => label.split('—')[0]?.trim() || label

const buildRolePrefixOptions = (mappings: RoleSkillMapping[]): RolePrefixOption[] => {
  const byPrefix = new Map<string, RolePrefixOption>()

  for (const department of TECHNICAL_DEPARTMENTS) {
    for (const role of roleOptionsForDiscipline(department)) {
      const prefix = rolePrefixFromCode(role.code)
      if (!byPrefix.has(prefix)) {
        byPrefix.set(prefix, {
          prefix,
          department,
          label: rolePositionLabel(role.label),
        })
      }
    }
  }

  for (const mapping of mappings) {
    const prefix = mapping.role_prefix.trim().toUpperCase()
    const department = departmentForRolePrefix(prefix)
    if (department && !byPrefix.has(prefix)) {
      byPrefix.set(prefix, {
        prefix,
        department,
        label: prefix,
      })
    }
  }

  return Array.from(byPrefix.values()).sort((a, b) =>
    `${a.department}-${a.prefix}`.localeCompare(`${b.department}-${b.prefix}`),
  )
}

const weightToSelectValue = (weight: number) => {
  const normalized = Number(weight)
  return Number.isFinite(normalized) ? String(normalized) : '1'
}

export function SkillRoleMappingManager() {
  const { userRole, userDepartment } = useOptimizedAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCategory, setNewSkillCategory] = useState('general')
  const [newSkillActive, setNewSkillActive] = useState(true)
  const [skillDrafts, setSkillDrafts] = useState<Record<string, SkillDraft>>({})
  const [selectedRolePrefix, setSelectedRolePrefix] = useState('')
  const [selectedSkillName, setSelectedSkillName] = useState('')
  const [selectedWeight, setSelectedWeight] = useState('1')

  const isManagementUser = userRole === 'admin' || userRole === 'management'

  const { data: skills = EMPTY_SKILLS, isLoading: skillsLoading } = useQuery({
    queryKey: SKILLS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from('skills')
        .select('id,name,category,active,created_at')
        .order('category', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error
      return (data ?? []) as Skill[]
    },
    enabled: isManagementUser,
  })

  const { data: mappings = EMPTY_ROLE_SKILL_MAPPINGS, isLoading: mappingsLoading } = useQuery({
    queryKey: ROLE_MAPPINGS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await dataLayerClient
        .from('role_skill_mapping')
        .select('id,role_prefix,skill_name,weight,created_at')
        .order('role_prefix', { ascending: true })
        .order('skill_name', { ascending: true })

      if (error) throw error
      return (data ?? []) as RoleSkillMapping[]
    },
    enabled: isManagementUser,
  })

  const rolePrefixOptions = useMemo(() => buildRolePrefixOptions(mappings), [mappings])
  const addableRolePrefixOptions = useMemo(
    () => rolePrefixOptions.filter((option) => canManageRolePrefix(option.prefix, userRole, userDepartment)),
    [rolePrefixOptions, userDepartment, userRole],
  )

  const skillByName = useMemo(() => {
    const next = new Map<string, Skill>()
    for (const skill of skills) {
      next.set(skill.name.toLowerCase(), skill)
    }
    return next
  }, [skills])

  const manageableSkills = useMemo(
    () => skills
      .filter((skill) => skill.active)
      .filter((skill) => canManageSkillCategory(skill.category, userRole, userDepartment)),
    [skills, userDepartment, userRole],
  )

  const categoryOptions = useMemo(() => {
    const existing = skills.map((skill) => normalizeCategory(skill.category))
    const defaults = userRole === 'admin'
      ? BASE_CATEGORY_OPTIONS
      : ['general', normalizeDepartment(userDepartment), `${normalizeDepartment(userDepartment)}-specialty`]

    return Array.from(new Set([...defaults, ...existing]))
      .filter(Boolean)
      .filter((category) => canManageSkillCategory(category, userRole, userDepartment))
      .sort()
  }, [skills, userDepartment, userRole])

  const groupedPrefixes = useMemo(() => {
    return rolePrefixOptions.reduce((acc, option) => {
      if (!acc[option.department]) acc[option.department] = []
      acc[option.department].push(option)
      return acc
    }, {} as Record<TechnicalDepartment, RolePrefixOption[]>)
  }, [rolePrefixOptions])

  const mappingsByPrefix = useMemo(() => {
    return mappings.reduce((acc, mapping) => {
      const prefix = mapping.role_prefix.trim().toUpperCase()
      if (!acc[prefix]) acc[prefix] = []
      acc[prefix].push(mapping)
      return acc
    }, {} as Record<string, RoleSkillMapping[]>)
  }, [mappings])

  useEffect(() => {
    setSkillDrafts((current) => {
      const next: Record<string, SkillDraft> = {}
      for (const skill of skills) {
        next[skill.id] = current[skill.id] ?? {
          name: skill.name,
          category: normalizeCategory(skill.category),
          active: skill.active,
        }
      }
      return next
    })
  }, [skills])

  useEffect(() => {
    if (!selectedRolePrefix && addableRolePrefixOptions[0]) {
      setSelectedRolePrefix(addableRolePrefixOptions[0].prefix)
    }
  }, [addableRolePrefixOptions, selectedRolePrefix])

  useEffect(() => {
    if (!selectedSkillName && manageableSkills[0]) {
      setSelectedSkillName(manageableSkills[0].name)
    }
  }, [manageableSkills, selectedSkillName])

  useEffect(() => {
    if (!categoryOptions.includes(newSkillCategory)) {
      setNewSkillCategory(categoryOptions[0] ?? 'general')
    }
  }, [categoryOptions, newSkillCategory])

  const invalidateCatalog = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: SKILLS_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: ROLE_MAPPINGS_QUERY_KEY }),
    ])
  }

  const createSkillMutation = useMutation({
    mutationFn: async () => {
      const name = normalizeSkillName(newSkillName)
      if (!name) throw new Error('El nombre de la habilidad es obligatorio')
      if (!canManageSkillCategory(newSkillCategory, userRole, userDepartment)) {
        throw new Error('No puedes crear habilidades en esa categoria')
      }

      const { error } = await dataLayerClient
        .from('skills')
        .insert({
          name,
          category: newSkillCategory,
          active: newSkillActive,
        })

      if (error) throw error
    },
    onSuccess: async () => {
      setNewSkillName('')
      setNewSkillActive(true)
      await invalidateCatalog()
      toast({ title: 'Habilidad creada' })
    },
    onError: (error) => {
      toast({
        title: 'No se pudo crear la habilidad',
        description: error instanceof Error ? error.message : 'No se pudo crear la habilidad',
        variant: 'destructive',
      })
    },
  })

  const updateSkillMutation = useMutation({
    mutationFn: async (skill: Skill) => {
      const draft = skillDrafts[skill.id]
      if (!draft) throw new Error('No hay cambios para guardar')

      const name = normalizeSkillName(draft.name)
      if (!name) throw new Error('El nombre de la habilidad es obligatorio')
      if (
        !canManageSkillCategory(skill.category, userRole, userDepartment)
        || !canManageSkillCategory(draft.category, userRole, userDepartment)
      ) {
        throw new Error('No puedes editar habilidades en esa categoria')
      }

      const { error } = await dataLayerClient
        .from('skills')
        .update({
          name,
          category: draft.category,
          active: draft.active,
        })
        .eq('id', skill.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await invalidateCatalog()
      toast({ title: 'Habilidad guardada' })
    },
    onError: (error) => {
      toast({
        title: 'No se pudo guardar la habilidad',
        description: error instanceof Error ? error.message : 'No se pudo actualizar la habilidad',
        variant: 'destructive',
      })
    },
  })

  const addMappingMutation = useMutation({
    mutationFn: async () => {
      const skillName = normalizeSkillName(selectedSkillName)
      const rolePrefix = selectedRolePrefix.trim().toUpperCase()
      const weight = Number(selectedWeight)

      if (!rolePrefix || !skillName) throw new Error('Elige un prefijo de rol y una habilidad')
      if (!Number.isFinite(weight) || weight <= 0) throw new Error('Elige un peso valido para el mapeo')
      if (!canManageRolePrefix(rolePrefix, userRole, userDepartment)) {
        throw new Error('No puedes gestionar ese prefijo de rol')
      }

      const skill = skillByName.get(skillName)
      if (!skill || !canManageSkillCategory(skill.category, userRole, userDepartment)) {
        throw new Error('No puedes mapear esa habilidad')
      }

      const { error } = await dataLayerClient
        .from('role_skill_mapping')
        .insert({
          role_prefix: rolePrefix,
          skill_name: skillName,
          weight,
        })

      if (error) throw error
    },
    onSuccess: async () => {
      await invalidateCatalog()
      toast({ title: 'Mapeo agregado' })
    },
    onError: (error) => {
      toast({
        title: 'No se pudo agregar el mapeo',
        description: error instanceof Error ? error.message : 'No se pudo agregar el mapeo',
        variant: 'destructive',
      })
    },
  })

  const updateMappingWeightMutation = useMutation({
    mutationFn: async ({ mapping, weight }: { mapping: RoleSkillMapping; weight: number }) => {
      if (!canEditMapping(mapping)) throw new Error('No puedes editar ese mapeo')
      if (!Number.isFinite(weight) || weight <= 0) throw new Error('Elige un peso valido para el mapeo')

      const { error } = await dataLayerClient
        .from('role_skill_mapping')
        .update({ weight })
        .eq('id', mapping.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await invalidateCatalog()
      toast({ title: 'Mapeo guardado' })
    },
    onError: (error) => {
      toast({
        title: 'No se pudo guardar el mapeo',
        description: error instanceof Error ? error.message : 'No se pudo actualizar el mapeo',
        variant: 'destructive',
      })
    },
  })

  const removeMappingMutation = useMutation({
    mutationFn: async (mapping: RoleSkillMapping) => {
      if (!canEditMapping(mapping)) throw new Error('No puedes eliminar ese mapeo')

      const { error } = await dataLayerClient
        .from('role_skill_mapping')
        .delete()
        .eq('id', mapping.id)

      if (error) throw error
    },
    onSuccess: async () => {
      await invalidateCatalog()
      toast({ title: 'Mapeo eliminado' })
    },
    onError: (error) => {
      toast({
        title: 'No se pudo eliminar el mapeo',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el mapeo',
        variant: 'destructive',
      })
    },
  })

  function canEditMapping(mapping: RoleSkillMapping) {
    if (userRole === 'admin') return true
    if (!canManageRolePrefix(mapping.role_prefix, userRole, userDepartment)) return false

    const skill = skillByName.get(mapping.skill_name.toLowerCase())
    return Boolean(skill && canManageSkillCategory(skill.category, userRole, userDepartment))
  }

  const updateSkillDraft = (skillId: string, patch: Partial<SkillDraft>) => {
    setSkillDrafts((current) => ({
      ...current,
      [skillId]: {
        ...(current[skillId] ?? { name: '', category: 'general', active: true }),
        ...patch,
      },
    }))
  }

  if (!isManagementUser) return null

  const isLoading = skillsLoading || mappingsLoading

  return (
    <div className="space-y-5">
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <div className="space-y-1.5">
          <Label htmlFor="new-skill-name">Nombre</Label>
          <Input
            id="new-skill-name"
            value={newSkillName}
            onChange={(event) => setNewSkillName(event.target.value)}
            placeholder="foh"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-skill-category">Categoria</Label>
          <Select value={newSkillCategory} onValueChange={setNewSkillCategory}>
            <SelectTrigger id="new-skill-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end gap-2 pb-2">
          <Switch
            id="new-skill-active"
            checked={newSkillActive}
            onCheckedChange={setNewSkillActive}
          />
          <Label htmlFor="new-skill-active">Activa</Label>
        </div>
        <Button
          type="button"
          className="self-end justify-self-start"
          onClick={() => createSkillMutation.mutate()}
          disabled={createSkillMutation.isPending || !newSkillName.trim()}
        >
          <Plus className="mr-2 h-4 w-4" />
          Crear
        </Button>
      </div>

      <div className="rounded-md border">
        <div className="border-b px-3 py-2 text-sm font-medium">Habilidades</div>
        <div className="max-h-96 divide-y overflow-y-auto">
          {isLoading && (
            <div className="px-3 py-3 text-sm text-muted-foreground">Cargando habilidades...</div>
          )}
          {!isLoading && skills.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">No hay habilidades.</div>
          )}
          {skills.map((skill) => {
            const draft = skillDrafts[skill.id] ?? {
              name: skill.name,
              category: normalizeCategory(skill.category),
              active: skill.active,
            }
            const canEditSkill = canManageSkillCategory(skill.category, userRole, userDepartment)
              && canManageSkillCategory(draft.category, userRole, userDepartment)

            return (
              <div key={skill.id} className="grid gap-2 px-3 py-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
                <Input
                  aria-label={`${skill.name} nombre de habilidad`}
                  value={draft.name}
                  onChange={(event) => updateSkillDraft(skill.id, { name: event.target.value })}
                  disabled={!canEditSkill}
                />
                <Select
                  value={draft.category}
                  onValueChange={(value) => updateSkillDraft(skill.id, { category: value })}
                  disabled={!canManageSkillCategory(skill.category, userRole, userDepartment)}
                >
                  <SelectTrigger aria-label={`${skill.name} categoria`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`skill-active-${skill.id}`}
                    checked={draft.active}
                    onCheckedChange={(checked) => updateSkillDraft(skill.id, { active: checked })}
                    disabled={!canEditSkill}
                  />
                  <Label htmlFor={`skill-active-${skill.id}`} className="text-sm">
                    Activa
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => updateSkillMutation.mutate(skill)}
                  disabled={!canEditSkill || updateSkillMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Guardar
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid gap-3 rounded-md border p-3 [grid-template-columns:repeat(auto-fit,minmax(150px,1fr))]">
        <div className="space-y-1.5">
          <Label htmlFor="mapping-role-prefix">Prefijo de rol</Label>
          <Select value={selectedRolePrefix} onValueChange={setSelectedRolePrefix}>
            <SelectTrigger id="mapping-role-prefix">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {addableRolePrefixOptions.map((option) => (
                <SelectItem key={option.prefix} value={option.prefix}>
                  {option.prefix} - {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mapping-skill">Habilidad</Label>
          <Select value={selectedSkillName} onValueChange={setSelectedSkillName}>
            <SelectTrigger id="mapping-skill">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {manageableSkills.map((skill) => (
                <SelectItem key={skill.id} value={skill.name}>
                  {skill.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mapping-weight">Peso</Label>
          <Select value={selectedWeight} onValueChange={setSelectedWeight}>
            <SelectTrigger id="mapping-weight">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEIGHT_PRESETS.map((preset) => (
                <SelectItem key={preset.value} value={String(preset.value)}>
                  {preset.label} {preset.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          className="self-end justify-self-start"
          onClick={() => addMappingMutation.mutate()}
          disabled={
            addMappingMutation.isPending
            || !selectedRolePrefix
            || !selectedSkillName
            || manageableSkills.length === 0
          }
        >
          <Link2 className="mr-2 h-4 w-4" />
          Agregar mapeo
        </Button>
      </div>

      <div className="max-h-[36rem] space-y-4 overflow-y-auto pr-1">
        {TECHNICAL_DEPARTMENTS.map((department) => {
          const options = groupedPrefixes[department] ?? []
          if (options.length === 0) return null

          return (
            <section key={department} className="space-y-2">
              <h3 className="text-sm font-medium">{DEPARTMENT_LABELS[department]}</h3>
              <div className="space-y-2">
                {options.map((option) => {
                  const prefixMappings = mappingsByPrefix[option.prefix] ?? []
                  const canManagePrefix = canManageRolePrefix(option.prefix, userRole, userDepartment)

                  return (
                    <div key={option.prefix} className="rounded-md border p-3">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary">{option.prefix}</Badge>
                        <span className="text-sm font-medium">{option.label}</span>
                        {!canManagePrefix && userRole !== 'admin' && (
                          <Badge variant="outline">Solo lectura</Badge>
                        )}
                      </div>
                      <div className="space-y-2">
                        {prefixMappings.length === 0 && (
                          <p className="text-sm text-muted-foreground">Sin habilidades mapeadas.</p>
                        )}
                        {prefixMappings.map((mapping) => {
                          const canEdit = canEditMapping(mapping)
                          const currentWeight = weightToSelectValue(mapping.weight)
                          const hasCustomWeight = !WEIGHT_PRESETS.some((preset) => String(preset.value) === currentWeight)

                          return (
                            <div
                              key={mapping.id}
                              className="grid gap-2 rounded border bg-muted/20 p-2 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-center"
                            >
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{mapping.skill_name}</div>
                                <div className="text-xs text-muted-foreground">Peso {mapping.weight}</div>
                              </div>
                              <Select
                                value={currentWeight}
                                onValueChange={(value) => updateMappingWeightMutation.mutate({
                                  mapping,
                                  weight: Number(value),
                                })}
                                disabled={!canEdit || updateMappingWeightMutation.isPending}
                              >
                                <SelectTrigger aria-label={`${mapping.role_prefix} ${mapping.skill_name} peso`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {hasCustomWeight && (
                                    <SelectItem value={currentWeight}>Personalizado {currentWeight}</SelectItem>
                                  )}
                                  {WEIGHT_PRESETS.map((preset) => (
                                    <SelectItem key={preset.value} value={String(preset.value)}>
                                      {preset.label} {preset.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label={`Eliminar mapeo ${mapping.role_prefix} ${mapping.skill_name}`}
                                onClick={() => removeMappingMutation.mutate(mapping)}
                                disabled={!canEdit || removeMappingMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
