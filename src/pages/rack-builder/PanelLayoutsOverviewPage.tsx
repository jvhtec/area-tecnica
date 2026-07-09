import { useNavigate } from 'react-router-dom'
import { useActiveRackBuilderDepartment } from '@/features/rack-builder/hooks/useActiveRackBuilderDepartment'
import { useProjects } from '@/features/rack-builder/hooks/useProjects'
import { usePanelLayoutCounts } from '@/features/rack-builder/hooks/usePanelLayoutCounts'
import { getRackBuilderProjectsPath } from '@/features/rack-builder/lib/department'
import PageHeader from '@/features/rack-builder/components/layout/PageHeader'
import Button from '@/features/rack-builder/components/ui/Button'

export default function PanelLayoutsOverviewPage() {
  const navigate = useNavigate()
  const activeDepartment = useActiveRackBuilderDepartment()
  const { projects, loading: projectsLoading } = useProjects(activeDepartment)
  const { counts, loading: countsLoading } = usePanelLayoutCounts()

  const loading = projectsLoading || countsLoading

  if (loading) {
    return <div className="text-gray-500">Loading...</div>
  }

  if (projects.length === 0) {
    return (
      <div>
        <PageHeader title="Panel Layouts" />
        <p className="text-gray-500 text-sm">
          No projects yet. Create a project first to start designing panel layouts.
        </p>
        <Button className="mt-3" onClick={() => navigate(getRackBuilderProjectsPath(activeDepartment))}>
          Go to Projects
        </Button>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Panel Layouts" />
      <p className="text-sm text-gray-500 mb-4">
        Select a project to view and manage its connector panel layouts.
      </p>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {projects.map((project) => {
          const panelCount = counts.get(project.id) ?? 0
          return (
            <article key={project.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {panelCount} panel layout{panelCount !== 1 ? 's' : ''}
                {project.owner ? ` · ${project.owner}` : ''}
              </p>
              <Button
                className="mt-3 w-full"
                onClick={() => navigate(`/rack-builder/editor/project/${project.id}/panels`)}
              >
                {panelCount > 0 ? 'Open Panel Layouts' : 'Create Panel Layout'}
              </Button>
            </article>
          )
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
              <th className="pb-2 font-medium">Project</th>
              <th className="pb-2 font-medium">Owner</th>
              <th className="pb-2 font-medium">Panel Layouts</th>
              <th className="pb-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => {
              const panelCount = counts.get(project.id) ?? 0
              return (
                <tr key={project.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <td className="py-3 font-medium text-gray-900 dark:text-white">{project.name}</td>
                  <td className="py-3 text-gray-500 dark:text-gray-400">{project.owner ?? '—'}</td>
                  <td className="py-3 dark:text-gray-300">{panelCount}</td>
                  <td className="py-3 text-right">
                    <Button onClick={() => navigate(`/rack-builder/editor/project/${project.id}/panels`)}>
                      {panelCount > 0 ? 'Open Panel Layouts' : 'Create Panel Layout'}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
