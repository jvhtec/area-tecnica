import { useSearchParams } from 'react-router-dom'
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth'
import { normalizeRackBuilderDepartment } from '../lib/department'
import type { RackBuilderDepartment } from '../types'

export function useActiveRackBuilderDepartment(): RackBuilderDepartment {
  const [searchParams] = useSearchParams()
  const { userDepartment } = useOptimizedAuth()

  return (
    normalizeRackBuilderDepartment(searchParams.get('department'))
    ?? normalizeRackBuilderDepartment(userDepartment)
    ?? 'sound'
  )
}
