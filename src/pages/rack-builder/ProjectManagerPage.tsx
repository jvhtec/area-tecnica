import { type FormEvent, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useProjects } from '@/features/rack-builder/hooks/useProjects'
import { useRacks } from '@/features/rack-builder/hooks/useRacks'
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth'
import { DRAWING_STATE_OPTIONS, formatDrawingState, formatRevisionLabel } from '@/features/rack-builder/lib/drawingState'
import {
  formatRackBuilderDepartment,
  normalizeRackBuilderDepartment,
} from '@/features/rack-builder/lib/department'
import type { DrawingState, ProjectSummary } from '@/features/rack-builder/types'
import PageHeader from '@/features/rack-builder/components/layout/PageHeader'
import Button from '@/features/rack-builder/components/ui/Button'
import Modal from '@/features/rack-builder/components/ui/Modal'
import ConfirmDialog from '@/features/rack-builder/components/ui/ConfirmDialog'
import Input from '@/features/rack-builder/components/ui/Input'
import Select from '@/features/rack-builder/components/ui/Select'

export default function ProjectManagerPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { userDepartment } = useOptimizedAuth()
  const activeDepartment =
    normalizeRackBuilderDepartment(searchParams.get('department'))
    ?? normalizeRackBuilderDepartment(userDepartment)
    ?? 'sound'
  const { projects, loading: projectsLoading, createProjectWithInitialLayout, updateProject, deleteProject } = useProjects(activeDepartment)
  const { racks, loading: racksLoading } = useRacks()

  const [formOpen, setFormOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<ProjectSummary | undefined>()
  const [deletingProject, setDeletingProject] = useState<ProjectSummary | undefined>()
  const [projectName, setProjectName] = useState('')
  const [projectOwner, setProjectOwner] = useState('')
  const [projectState, setProjectState] = useState<DrawingState>('preliminary')
  const [initialLayoutName, setInitialLayoutName] = useState('Main Layout')
  const [initialLayoutState, setInitialLayoutState] = useState<DrawingState>('preliminary')
  const [rackId, setRackId] = useState('')
  const [editName, setEditName] = useState('')
  const [editOwner, setEditOwner] = useState('')
  const [editState, setEditState] = useState<DrawingState>('preliminary')
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const openEditModal = (project: ProjectSummary) => {
    setEditName(project.name)
    setEditOwner(project.owner ?? '')
    setEditState(project.drawing_state)
    setEditError(null)
    setEditingProject(project)
  }

  const handleEditSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const name = editName.trim()
    const owner = editOwner.trim() || null
    if (!editingProject || !name) return
    setSaving(true)
    try {
      await updateProject(editingProject.id, { name, owner, drawing_state: editState })
      setEditingProject(undefined)
    } catch (err) {
      console.error('Failed to update project:', err)
      setEditError(err instanceof Error ? err.message : 'Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const openCreateModal = () => {
    setProjectName('')
    setProjectOwner('')
    setProjectState('preliminary')
    setInitialLayoutName('Main Layout')
    setInitialLayoutState('preliminary')
    setRackId(racks[0]?.id ?? '')
    setFormOpen(true)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedName = projectName.trim()
    const trimmedOwner = projectOwner.trim() || undefined
    const trimmedLayoutName = initialLayoutName.trim()
    if (!trimmedName || !trimmedLayoutName || !rackId) return

    setSaving(true)
    try {
      const result = await createProjectWithInitialLayout({
        project_name: trimmedName,
        project_owner: trimmedOwner,
        drawing_state: projectState,
        initial_layout_name: trimmedLayoutName,
        initial_layout_state: initialLayoutState,
        rack_id: rackId,
      })

      setFormOpen(false)
      navigate(`/rack-builder/editor/project/${result.project.id}?layout=${result.layout_id}`)
    } finally {
      setSaving(false)
    }
  }

  if (projectsLoading || racksLoading) {
    return <div className="text-gray-500">Loading...</div>
  }

  return (
    <div>
      <PageHeader
        title={`Project Manager - ${formatRackBuilderDepartment(activeDepartment)}`}
        action={
          <Button onClick={openCreateModal} disabled={racks.length === 0}>
            New Project
          </Button>
        }
      />

      {racks.length === 0 && (
        <p className="text-amber-600 text-sm mb-4">
          Create a rack definition first before creating projects.
        </p>
      )}

      {projects.length === 0 ? (
        <p className="text-gray-500 text-sm">No projects yet. Create one to get started.</p>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {projects.map((project) => (
              <article key={project.id} className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</h2>
                <dl className="mt-2 grid grid-cols-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <dt>Owner</dt>
                  <dd className="text-right">{project.owner ?? '—'}</dd>
                  <dt>Layouts</dt>
                  <dd className="text-right">{project.layout_count}</dd>
                  <dt>Created</dt>
                  <dd className="text-right">{new Date(project.created_at).toLocaleDateString()}</dd>
                  <dt>State</dt>
                  <dd className="text-right">{formatDrawingState(project.drawing_state)}</dd>
                  <dt>Revision</dt>
                  <dd className="text-right">{formatRevisionLabel(project.drawing_state, project.revision_number)}</dd>
                </dl>
                <div className="mt-3 grid grid-cols-1 gap-2">
                  <Button onClick={() => navigate(`/rack-builder/editor/project/${project.id}`)}>Open Editor</Button>
                  <Button variant="secondary" onClick={() => navigate(`/rack-builder/editor/project/${project.id}/panels`)}>
                    Panel Layouts
                  </Button>
                  <Button variant="secondary" onClick={() => openEditModal(project)}>Edit</Button>
                  <Button variant="danger" onClick={() => setDeletingProject(project)}>Delete</Button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Owner</th>
                  <th className="pb-2 font-medium">Layouts</th>
                  <th className="pb-2 font-medium">State</th>
                  <th className="pb-2 font-medium">Revision</th>
                  <th className="pb-2 font-medium">Created</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <tr key={project.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-3 font-medium text-gray-900 dark:text-white">{project.name}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{project.owner ?? '—'}</td>
                    <td className="py-3 dark:text-gray-300">{project.layout_count}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{formatDrawingState(project.drawing_state)}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{formatRevisionLabel(project.drawing_state, project.revision_number)}</td>
                    <td className="py-3 text-gray-500 dark:text-gray-400">{new Date(project.created_at).toLocaleDateString()}</td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button onClick={() => navigate(`/rack-builder/editor/project/${project.id}`)}>Open Editor</Button>
                        <Button variant="secondary" onClick={() => navigate(`/rack-builder/editor/project/${project.id}/panels`)}>
                          Panel Layouts
                        </Button>
                        <Button variant="secondary" onClick={() => openEditModal(project)}>Edit</Button>
                        <Button variant="danger" onClick={() => setDeletingProject(project)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="New Project">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Project Name"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
          />
          <Input
            label="Project Owner"
            value={projectOwner}
            onChange={(e) => setProjectOwner(e.target.value)}
            placeholder="e.g. John Smith"
          />
          <Select
            label="Project Drawing State"
            value={projectState}
            onChange={(e) => setProjectState(e.target.value as DrawingState)}
            options={DRAWING_STATE_OPTIONS}
          />
          <Input
            label="Initial Layout Name"
            value={initialLayoutName}
            onChange={(e) => setInitialLayoutName(e.target.value)}
            required
          />
          <Select
            label="Initial Layout State"
            value={initialLayoutState}
            onChange={(e) => setInitialLayoutState(e.target.value as DrawingState)}
            options={DRAWING_STATE_OPTIONS}
          />
          <Select
            label="Rack"
            value={rackId}
            onChange={(e) => setRackId(e.target.value)}
            options={racks.map((rack) => ({ value: rack.id, label: `${rack.name} (${rack.rack_units}U)` }))}
          />

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" type="button" onClick={() => setFormOpen(false)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !projectName || !initialLayoutName || !rackId} className="w-full sm:w-auto">
              {saving ? 'Creating...' : 'Create Project'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!editingProject} onClose={() => setEditingProject(undefined)} title="Edit Project">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <Input
            label="Project Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
          />
          <Input
            label="Project Owner"
            value={editOwner}
            onChange={(e) => setEditOwner(e.target.value)}
            placeholder="e.g. John Smith"
          />
          <Select
            label="Project Drawing State"
            value={editState}
            onChange={(e) => setEditState(e.target.value as DrawingState)}
            options={DRAWING_STATE_OPTIONS}
          />
          {editError && <p className="text-sm text-red-600">{editError}</p>}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" type="button" onClick={() => setEditingProject(undefined)} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !editName.trim()} className="w-full sm:w-auto">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(undefined)}
        onConfirm={() => deletingProject && deleteProject(deletingProject.id)}
        title="Delete Project"
        message={`Are you sure you want to delete "${deletingProject?.name}"? All layouts and placed devices in this project will be removed.`}
      />
    </div>
  )
}
