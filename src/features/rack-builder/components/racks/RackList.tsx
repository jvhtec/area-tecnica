import type { Rack } from '../../types'
import Button from '../ui/Button'

interface RackListProps {
  racks: Rack[]
  onEdit: (rack: Rack) => void
  onDelete: (rack: Rack) => void
}

export default function RackList({ racks, onEdit, onDelete }: RackListProps) {
  if (racks.length === 0) {
    return <p className="text-gray-500 text-sm">No racks defined yet. Create one to get started.</p>
  }

  return (
    <>
      <div className="space-y-3 md:hidden">
        {racks.map((rack) => (
          <article key={rack.id} className="rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{rack.name}</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
              <dt>Rack Units</dt>
              <dd className="text-right">{rack.rack_units}U</dd>
              <dt>Depth</dt>
              <dd className="text-right">{rack.depth_mm}mm</dd>
              <dt>Width</dt>
              <dd className="text-right capitalize">{rack.width}</dd>
            </dl>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => onEdit(rack)}>
                Edit
              </Button>
              <Button variant="danger" onClick={() => onDelete(rack)}>
                Delete
              </Button>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Rack Units</th>
              <th className="pb-2 font-medium">Depth (mm)</th>
              <th className="pb-2 font-medium">Width</th>
              <th className="pb-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {racks.map((rack) => (
              <tr key={rack.id} className="border-b dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="py-3 font-medium text-gray-900 dark:text-white">{rack.name}</td>
                <td className="py-3 dark:text-gray-300">{rack.rack_units}U</td>
                <td className="py-3 dark:text-gray-300">{rack.depth_mm}mm</td>
                <td className="py-3 capitalize dark:text-gray-300">{rack.width}</td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={() => onEdit(rack)}>
                      Edit
                    </Button>
                    <Button variant="danger" onClick={() => onDelete(rack)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
