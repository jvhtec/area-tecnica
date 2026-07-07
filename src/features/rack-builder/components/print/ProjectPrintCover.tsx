import logoUrl from '../../assets/sector-pro-logo.png'
import type { Project } from '../../types'

interface ProjectPrintCoverProps {
  project: Project
  generatedAt: Date
}

export default function ProjectPrintCover({ project, generatedAt }: ProjectPrintCoverProps) {
  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(generatedAt)

  return (
    <section className="layout-print-sheet layout-print-page-break" aria-label="Project print cover">
      <div className="layout-print-sheet-inner">
        <div className="project-print-cover project-print-cover--full-height">
          <img src={logoUrl} alt="Sector Pro" className="project-print-cover-logo" crossOrigin="anonymous" />
          <p className="project-print-cover-kicker">Technical Documentation</p>
          <h1 className="project-print-cover-title">{project.name}</h1>
          {project.owner && <p className="project-print-cover-owner">Owner / Client: {project.owner}</p>}
          <p className="project-print-cover-generated">Generated {generatedAtLabel}</p>
        </div>
      </div>
    </section>
  )
}
