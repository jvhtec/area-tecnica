import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export interface ResponsiveTableColumn<T = any> {
  key: string
  header: string
  accessor: (item: T) => React.ReactNode
  className?: string
  mobileLabel?: string
  hideOnMobile?: boolean
  priority?: number
}

export interface ResponsiveTableProps<T = any> {
  data: T[]
  columns: ResponsiveTableColumn<T>[]
  keyExtractor: (item: T, index: number) => string | number
  onRowClick?: (item: T) => void
  emptyMessage?: string
  className?: string
  mobileCardTitle?: (item: T) => React.ReactNode
  breakpoint?: "sm" | "md" | "lg"
}

export function ResponsiveTable<T = any>({
  data,
  columns,
  keyExtractor,
  onRowClick,
  emptyMessage = "No data available",
  className,
  mobileCardTitle,
  breakpoint = "md",
}: ResponsiveTableProps<T>) {
  const breakpointClass = {
    sm: "sm:table",
    md: "md:table",
    lg: "lg:table",
  }[breakpoint]

  const breakpointHidden = {
    sm: "sm:hidden",
    md: "md:hidden",
    lg: "lg:hidden",
  }[breakpoint]

  const sortedColumns = React.useMemo(() => {
    return [...columns].sort((a, b) => {
      const priorityA = a.priority ?? 0
      const priorityB = b.priority ?? 0
      return priorityB - priorityA
    })
  }, [columns])

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {emptyMessage}
      </div>
    )
  }

  return (
    <>
      <div className={cn("hidden", breakpointClass, className)}>
        <div className="border rounded-md overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <TableHead key={column.key} className={column.className}>
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow
                  key={keyExtractor(item, index)}
                  onClick={() => onRowClick?.(item)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.accessor(item)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className={cn("space-y-3", breakpointHidden)}>
        {data.map((item, index) => {
          const visibleColumns = sortedColumns.filter(col => !col.hideOnMobile)
          const titleContent = mobileCardTitle?.(item)
          
          return (
            <Card
              key={keyExtractor(item, index)}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? "cursor-pointer hover:bg-accent/50 transition-colors" : undefined}
            >
              {titleContent && (
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">
                    {titleContent}
                  </CardTitle>
                </CardHeader>
              )}
              <CardContent className={titleContent ? "pt-0" : undefined}>
                <div className="space-y-3">
                  {visibleColumns.map((column) => {
                    const label = column.mobileLabel || column.header
                    const value = column.accessor(item)
                    
                    return (
                      <div key={column.key} className="flex justify-between items-start gap-4">
                        <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
                          {label}:
                        </span>
                        <span className="text-sm text-right flex-1">
                          {value}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </>
  )
}
