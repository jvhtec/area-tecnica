import PrintCartouche from './PrintCartouche'

interface ProjectPrintIndexRow {
  layoutName: string
  rackName: string
  rackSpec: string
  totalPowerW: number
  totalWeightKg: number
  pageNumber: number
}

interface ProjectPrintIndexProps {
  projectName: string
  rows: ProjectPrintIndexRow[]
  generatedAt: Date
  pageNumber: number
  pageCount: number
}

export default function ProjectPrintIndex({
  projectName,
  rows,
  generatedAt,
  pageNumber,
  pageCount,
}: ProjectPrintIndexProps) {
  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt)

  return (
    <section className="layout-print-sheet layout-print-page-break" aria-label="Project layout index">
      <div className="layout-print-sheet-inner">
        <div className="project-print-index-wrap">
          <h2 className="project-print-index-title">Layout Index</h2>
          <div className="project-print-index-table-wrap">
          <table className="project-print-index-table">
            <colgroup>
              <col className="project-print-index-col-num" />
              <col className="project-print-index-col-layout" />
              <col className="project-print-index-col-rack" />
              <col className="project-print-index-col-spec" />
              <col className="project-print-index-col-power" />
              <col className="project-print-index-col-weight" />
              <col className="project-print-index-col-page" />
            </colgroup>
            <thead>
              <tr>
                <th>#</th>
                <th>Layout</th>
                <th>Rack</th>
                <th>Rack Spec</th>
                <th>Power</th>
                <th>Weight</th>
                <th>Page</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.layoutName}-${index}`}>
                  <td>{index + 1}</td>
                  <td>{row.layoutName}</td>
                  <td>{row.rackName}</td>
                  <td>{row.rackSpec}</td>
                  <td>{row.totalPowerW} W</td>
                  <td>{row.totalWeightKg.toFixed(2)} kg</td>
                  <td>{row.pageNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>

        <PrintCartouche
          title="Layout Index"
          jobName={projectName}
          pageNumber={pageNumber}
          pageCount={pageCount}
          extraFields={[
            { label: 'Rows', value: `${rows.length}` },
            { label: 'Generated', value: generatedAtLabel },
          ]}
        />
      </div>
    </section>
  )
}
