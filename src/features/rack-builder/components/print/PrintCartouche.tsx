import logoUrl from '../../assets/sector-pro-logo.png'

interface PrintCartoucheField {
  label: string
  value: string
}

interface PrintCartoucheProps {
  title: string
  jobName: string
  pageNumber: number
  pageCount: number
  extraFields?: PrintCartoucheField[]
  logoSrc?: string
  logoAlt?: string
}

function normalizeFields(fields: PrintCartoucheField[]): PrintCartoucheField[] {
  const normalized = fields
    .filter((field) => field.label.trim().length > 0 || field.value.trim().length > 0)
    .slice(0, 8)

  while (normalized.length < 8) {
    normalized.push({ label: '', value: '' })
  }

  return normalized
}

export default function PrintCartouche({
  title,
  jobName,
  pageNumber,
  pageCount,
  extraFields = [],
  logoSrc = logoUrl,
  logoAlt = 'Sector Pro',
}: PrintCartoucheProps) {
  const bodyFields = normalizeFields([
    { label: 'Title', value: title },
    { label: 'Job Name', value: jobName },
    ...extraFields,
  ])

  const pageLabel = `${pageNumber} / ${pageCount}`

  return (
    <section className="print-cartouche" aria-label="Drawing cartouche">
      {bodyFields.map((field, i) => (
        <div key={`${field.label}-${i}`} className="print-cartouche-cell">
          {field.label && <p className="print-cartouche-label">{field.label}</p>}
          {field.value && <p className="print-cartouche-value" title={field.value}>{field.value}</p>}
        </div>
      ))}
      <div className="print-cartouche-cell print-cartouche-logo">
        <img src={logoSrc} alt={logoAlt} className="print-cartouche-logo-image" crossOrigin="anonymous" />
      </div>
      <div className="print-cartouche-cell">
        <p className="print-cartouche-label">Page</p>
        <p className="print-cartouche-value" title={pageLabel}>{pageLabel}</p>
      </div>
    </section>
  )
}
