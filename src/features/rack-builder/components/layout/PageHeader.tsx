import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  action?: ReactNode
}

export default function PageHeader({ title, action }: PageHeaderProps) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">{title}</h1>
      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </div>
  )
}
