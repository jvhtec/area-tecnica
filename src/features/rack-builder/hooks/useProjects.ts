import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import type { DrawingState, Project, ProjectSummary } from '../types'

interface ProjectWithLayoutsRow extends Project {
  layouts?: Array<{ id: string }>
}

export function useProjects() {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('rack_builder_projects')
      .select('*, layouts:rack_builder_layouts(id)')
      .order('created_at', { ascending: false })

    if (err) {
      setError(err.message)
    } else {
      const rows = (data ?? []) as ProjectWithLayoutsRow[]
      const mapped: ProjectSummary[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        owner: row.owner ?? null,
        drawing_state: row.drawing_state,
        revision_number: row.revision_number,
        created_at: row.created_at,
        updated_at: row.updated_at,
        layout_count: row.layouts?.length ?? 0,
      }))
      setProjects(mapped)
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void fetchProjects()
    }, 0)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [fetchProjects])

  const createProjectWithInitialLayout = async (payload: {
    project_name: string
    project_owner?: string
    drawing_state: DrawingState
    initial_layout_name: string
    initial_layout_state: DrawingState
    rack_id: string
  }) => {
    const { data: projectData, error: projectErr } = await supabase
      .from('rack_builder_projects')
      .insert({
        name: payload.project_name,
        owner: payload.project_owner ?? null,
        drawing_state: payload.drawing_state,
      })
      .select()
      .single()

    if (projectErr) throw projectErr

    const project = projectData as Project

    const { data: layoutData, error: layoutErr } = await supabase
      .from('rack_builder_layouts')
      .insert({
        project_id: project.id,
        name: payload.initial_layout_name,
        rack_id: payload.rack_id,
        drawing_state: payload.initial_layout_state,
      })
      .select('id')
      .single()

    if (layoutErr) {
      await supabase.from('rack_builder_projects').delete().eq('id', project.id)
      throw layoutErr
    }

    await fetchProjects()

    return {
      project,
      layout_id: (layoutData as { id: string }).id,
    }
  }

  const updateProject = async (
    id: string,
    updates: Partial<{ name: string; owner: string | null; drawing_state: DrawingState }>,
  ) => {
    const { error: err } = await supabase
      .from('rack_builder_projects')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (err) throw err
    await fetchProjects()
  }

  const deleteProject = async (id: string) => {
    const { error: err } = await supabase.from('rack_builder_projects').delete().eq('id', id)
    if (err) throw err
    await fetchProjects()
  }

  const fetchProjectById = async (id: string): Promise<Project | null> => {
    const { data, error: err } = await supabase.from('rack_builder_projects').select('*').eq('id', id).single()
    if (err) return null
    return data as Project
  }

  return {
    projects,
    loading,
    error,
    createProjectWithInitialLayout,
    updateProject,
    deleteProject,
    fetchProjectById,
    refetch: fetchProjects,
  }
}
