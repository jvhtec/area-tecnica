import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useRatesApprovals } from '@/features/rates/hooks/useRatesApprovals';
import { format, parseISO } from 'date-fns';

function tryFormatDate(value: string | null | undefined, pattern: string, fallback: string) {
  if (!value) return fallback;
  try {
    const parsed = parseISO(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return format(parsed, pattern);
  } catch (error) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return fallback;
    return format(parsed, pattern);
  }
}

interface RatesApprovalsTableProps {
  onManageTour: (tourId: string) => void;
}

export function RatesApprovalsTable({ onManageTour }: RatesApprovalsTableProps) {
  const { data: rows = [], isLoading } = useRatesApprovals();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tour approval readiness</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tours available yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tour</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead className="text-right">Tour dates</TableHead>
                  <TableHead className="text-right">Assignments</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium leading-tight">{row.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {(() => {
                          const formatted = tryFormatDate(row.endDate, 'PPP', '');
                          return formatted ? `Ends ${formatted}` : 'End date TBD';
                        })()}
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.startDate ? tryFormatDate(row.startDate, 'PPP', '—') : '—'}
                    </TableCell>
                    <TableCell className="text-right">{row.jobCount}</TableCell>
                    <TableCell className="text-right">{row.assignmentCount}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {row.pendingIssues.length === 0 ? (
                          <Badge variant="outline">Ready</Badge>
                        ) : (
                          row.pendingIssues.map((issue) => (
                            <Badge key={issue} variant={issue === 'Approval required' ? 'destructive' : 'secondary'}>
                              {issue}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" onClick={() => onManageTour(row.id)}>
                        Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
