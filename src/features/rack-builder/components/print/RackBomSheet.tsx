import { useMemo } from 'react'
import PrintCartouche from './PrintCartouche'
import type { Layout, LayoutItemWithDevice, Rack } from '../../types'
import { formatDrawingState, formatRevisionLabel } from '../../lib/drawingState'

interface BomRow {
  deviceId: string
  brand: string
  model: string
  rackUnits: number
  weightKg: number
  powerW: number
  quantity: number
}

/** Maximum BOM data rows that fit on one fixed-height A3 sheet. */
export const MAX_BOM_ROWS_PER_PAGE = 30

/** Compute how many sheets a BOM with `uniqueDeviceCount` rows will need. */
export function getBomPageCount(uniqueDeviceCount: number): number {
  if (uniqueDeviceCount <= 0) return 1
  return Math.ceil(uniqueDeviceCount / MAX_BOM_ROWS_PER_PAGE)
}

interface RackBomSheetProps {
  layout: Layout
  rack: Rack
  items: LayoutItemWithDevice[]
  generatedAt: Date
  projectOwner?: string | null
  totalWeightKg: number
  totalPowerW: number
  /** Page number of the first BOM sheet. Subsequent pages increment from here. */
  startPageNumber: number
  pageCount: number
  sheetClassName?: string
  /** Insert a page break after the final BOM page (default false). */
  breakAfterLastPage?: boolean
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks.length > 0 ? chunks : [[]]
}

export default function RackBomSheet({
  layout,
  rack,
  items,
  generatedAt,
  projectOwner,
  totalWeightKg,
  totalPowerW,
  startPageNumber,
  pageCount,
  sheetClassName,
  breakAfterLastPage = false,
}: RackBomSheetProps) {
  const bomRows = useMemo(() => {
    const grouped = new Map<string, BomRow>()

    for (const item of items) {
      const key = item.device.id
      const existing = grouped.get(key)
      if (existing) {
        existing.quantity += 1
      } else {
        grouped.set(key, {
          deviceId: item.device.id,
          brand: item.device.brand,
          model: item.device.model,
          rackUnits: item.device.rack_units,
          weightKg: item.device.weight_kg,
          powerW: item.device.power_w,
          quantity: 1,
        })
      }
    }

    return Array.from(grouped.values()).sort((a, b) => {
      const brandCmp = a.brand.localeCompare(b.brand)
      if (brandCmp !== 0) return brandCmp
      return a.model.localeCompare(b.model)
    })
  }, [items])

  const generatedAtLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(generatedAt)
  const generatedBy = projectOwner ? `${projectOwner} — ${generatedAtLabel}` : generatedAtLabel

  const totalDevices = bomRows.reduce((sum, row) => sum + row.quantity, 0)
  const totalRackUnits = bomRows.reduce((sum, row) => sum + row.rackUnits * row.quantity, 0)

  const pages = useMemo(() => chunkArray(bomRows, MAX_BOM_ROWS_PER_PAGE), [bomRows])

  const colGroup = (
    <colgroup>
      <col className="rack-bom-col-num" />
      <col className="rack-bom-col-brand" />
      <col className="rack-bom-col-model" />
      <col className="rack-bom-col-ru" />
      <col className="rack-bom-col-qty" />
      <col className="rack-bom-col-weight-each" />
      <col className="rack-bom-col-power-each" />
      <col className="rack-bom-col-weight-total" />
      <col className="rack-bom-col-power-total" />
    </colgroup>
  )

  const tableHead = (
    <thead>
      <tr>
        <th>#</th>
        <th>Brand</th>
        <th>Model</th>
        <th>RU</th>
        <th>Qty</th>
        <th>Weight (ea)</th>
        <th>Power (ea)</th>
        <th>Weight (tot)</th>
        <th>Power (tot)</th>
      </tr>
    </thead>
  )

  return (
    <>
      {pages.map((pageRows, pageIndex) => {
        const isLastPage = pageIndex === pages.length - 1
        const rowOffset = pageIndex * MAX_BOM_ROWS_PER_PAGE
        const currentPageNumber = startPageNumber + pageIndex
        const needsPageBreak = !isLastPage || breakAfterLastPage
        const combinedClass =
          `layout-print-sheet ${sheetClassName ?? ''} ${needsPageBreak ? 'layout-print-page-break' : ''}`.replace(/\s+/g, ' ').trim()

        return (
          <section
            key={pageIndex}
            className={combinedClass}
            aria-label={`Bill of Materials for ${layout.name}${pages.length > 1 ? ` (page ${pageIndex + 1} of ${pages.length})` : ''}`}
          >
            <div className="layout-print-sheet-inner">
              <div className="rack-bom-wrap">
                <h2 className="rack-bom-title">Bill of Materials</h2>
                <p className="rack-bom-subtitle">
                  {layout.name} — {rack.name} ({rack.rack_units}U {rack.width} {rack.depth_mm}mm)
                  {pages.length > 1 && ` — Sheet ${pageIndex + 1}/${pages.length}`}
                </p>

                <div className="rack-bom-table-wrap">
                  <table className="rack-bom-table">
                    {colGroup}
                    {tableHead}
                    <tbody>
                      {pageRows.map((row, index) => (
                        <tr key={row.deviceId}>
                          <td>{rowOffset + index + 1}</td>
                          <td>{row.brand}</td>
                          <td>{row.model}</td>
                          <td>{row.rackUnits}U</td>
                          <td>{row.quantity}</td>
                          <td>{row.weightKg.toFixed(2)} kg</td>
                          <td>{row.powerW} W</td>
                          <td>{(row.weightKg * row.quantity).toFixed(2)} kg</td>
                          <td>{row.powerW * row.quantity} W</td>
                        </tr>
                      ))}
                    </tbody>
                    {isLastPage && (
                      <tfoot>
                        <tr className="rack-bom-totals-row">
                          <td colSpan={3}>Totals</td>
                          <td>{totalRackUnits}U</td>
                          <td>{totalDevices}</td>
                          <td></td>
                          <td></td>
                          <td>{totalWeightKg.toFixed(2)} kg</td>
                          <td>{totalPowerW} W</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {isLastPage && (
                  <p className="rack-bom-footnote">
                    {rack.rack_units - totalRackUnits}U free of {rack.rack_units}U total rack space
                  </p>
                )}
              </div>

              <PrintCartouche
                title="Bill of Materials"
                jobName={layout.name}
                pageNumber={currentPageNumber}
                pageCount={pageCount}
                extraFields={[
                  { label: 'Rack', value: rack.name },
                  { label: 'Rack Spec', value: `${rack.rack_units}U | ${rack.width} | ${rack.depth_mm}mm` },
                  { label: 'State', value: formatDrawingState(layout.drawing_state) },
                  { label: 'Revision', value: formatRevisionLabel(layout.drawing_state, layout.revision_number) },
                  { label: 'Devices', value: `${bomRows.length} unique / ${totalDevices} total` },
                  { label: 'Weight / Power', value: `${totalWeightKg.toFixed(2)} kg / ${totalPowerW} W` },
                  { label: 'Generated', value: generatedBy },
                ]}
              />
            </div>
          </section>
        )
      })}
    </>
  )
}
