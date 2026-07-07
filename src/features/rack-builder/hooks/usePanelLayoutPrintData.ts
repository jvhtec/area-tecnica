import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { mapPanelLayout, type PanelLayoutRecord } from '../lib/panelLayoutMapper'
import type { PanelLayout, Project } from '../types'

export function usePanelLayoutPrintData(projectId: string | undefined, panelLayoutId: string | undefined) {
  const [project, setProject] = useState<Project | null>(null)
  const [panel, setPanel] = useState<PanelLayout | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      if (!projectId || !panelLayoutId) {
        setError('Missing project or panel id')
        setLoading(false)
        return
      }
      setLoading(true)
      const [{ data: projectData, error: projectError }, { data: panelData, error: panelError }] = await Promise.all([
        supabase.from('rack_builder_projects').select('*').eq('id', projectId).single(),
        supabase
          .from('rack_builder_panel_layouts')
          .select('*, rows:rack_builder_panel_layout_rows(*), ports:rack_builder_panel_layout_ports(*)')
          .eq('project_id', projectId)
          .eq('id', panelLayoutId)
          .single(),
      ])

      if (!active) return

      if (projectError || !projectData) {
        setError('Project not found')
        setLoading(false)
        return
      }
      if (panelError || !panelData) {
        setError('Panel layout not found')
        setLoading(false)
        return
      }

      setProject(projectData as Project)
      setPanel(mapPanelLayout(panelData as unknown as PanelLayoutRecord))
      setError(null)
      setLoading(false)
    }

    void load()
    return () => {
      active = false
    }
  }, [panelLayoutId, projectId])

  return { project, panel, loading, error }
}
