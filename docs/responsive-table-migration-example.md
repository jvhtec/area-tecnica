# ResponsiveTable Migration Example

This document shows a real-world example of migrating the TaskList component from a traditional table to the new ResponsiveTable component.

## Original TaskList Component (Simplified)

```tsx
// Before: Traditional table that scrolls horizontally on mobile
export const TaskList: React.FC<TaskListProps> = ({ jobId, department }) => {
  const { tasks } = useJobTasks(jobId, department);

  return (
    <div className="border rounded">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Attachments</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks?.map((task) => (
            <TableRow key={task.id}>
              <TableCell className="font-medium">{task.task_type}</TableCell>
              <TableCell>
                {task.assigned_to 
                  ? `${task.assigned_to.first_name} ${task.assigned_to.last_name}` 
                  : '-'}
              </TableCell>
              <TableCell>
                <Select value={task.status} onValueChange={(v) => updateStatus(task.id, v)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={task.progress || 0} className="h-2" />
                  <span className="text-xs">{task.progress || 0}%</span>
                </div>
              </TableCell>
              <TableCell>
                {task.due_at ? format(new Date(task.due_at), 'PP') : '-'}
              </TableCell>
              <TableCell>
                {task.task_documents?.length || 0} files
              </TableCell>
              <TableCell>
                <Button size="sm" onClick={() => editTask(task)}>
                  Edit
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
```

**Problems on Mobile:**
- 7 columns force horizontal scrolling
- Small touch targets in dropdowns
- Progress bars hard to read
- Difficult to see all info at once

## Migrated ResponsiveTable Version

```tsx
import { ResponsiveTable, ResponsiveTableColumn } from '@/components/shared/ResponsiveTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';

export const TaskList: React.FC<TaskListProps> = ({ jobId, department }) => {
  const { tasks } = useJobTasks(jobId, department);

  const columns: ResponsiveTableColumn<Task>[] = [
    {
      key: 'type',
      header: 'Type',
      accessor: (task) => (
        <span className="font-medium">{task.task_type}</span>
      ),
      priority: 5,
      className: 'font-medium',
    },
    {
      key: 'assignee',
      header: 'Assignee',
      mobileLabel: 'Assigned To',
      accessor: (task) => (
        task.assigned_to 
          ? `${task.assigned_to.first_name} ${task.assigned_to.last_name}` 
          : <span className="text-muted-foreground">Unassigned</span>
      ),
      priority: 4,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (task) => (
        <StatusBadge status={task.status} />
      ),
      priority: 3,
    },
    {
      key: 'progress',
      header: 'Progress',
      accessor: (task) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <Progress value={task.progress || 0} className="h-2 flex-1" />
          <span className="text-xs font-medium whitespace-nowrap">
            {task.progress || 0}%
          </span>
        </div>
      ),
      priority: 2,
    },
    {
      key: 'due',
      header: 'Due Date',
      mobileLabel: 'Due',
      accessor: (task) => (
        task.due_at 
          ? format(new Date(task.due_at), 'PP')
          : <span className="text-muted-foreground">-</span>
      ),
      priority: 1,
    },
    {
      key: 'attachments',
      header: 'Attachments',
      mobileLabel: 'Files',
      accessor: (task) => {
        const count = task.task_documents?.length || 0;
        return (
          <div className="flex items-center gap-2">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            <span>{count}</span>
          </div>
        );
      },
      hideOnMobile: false, // Show but with lower priority
      priority: 0,
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (task) => (
        <Button 
          size="sm" 
          onClick={(e) => {
            e.stopPropagation();
            editTask(task);
          }}
        >
          Edit
        </Button>
      ),
      priority: 0,
      className: 'text-right',
    },
  ];

  return (
    <ResponsiveTable
      data={tasks || []}
      columns={columns}
      keyExtractor={(task) => task.id}
      onRowClick={(task) => viewTaskDetails(task)}
      mobileCardTitle={(task) => (
        <div className="flex items-center justify-between">
          <span className="font-semibold">{task.task_type}</span>
          <StatusBadge status={task.status} />
        </div>
      )}
      emptyMessage="No tasks found"
      breakpoint="md"
    />
  );
};

// Helper component for consistent status display
function StatusBadge({ status }: { status: string }) {
  const variants = {
    not_started: 'secondary',
    in_progress: 'default',
    completed: 'success',
  };

  const labels = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
  };

  return (
    <Badge variant={variants[status as keyof typeof variants]}>
      {labels[status as keyof typeof labels]}
    </Badge>
  );
}
```

## Mobile View Result

### Desktop (≥768px)
Traditional table with all columns visible:
```
┌──────────┬───────────┬─────────────┬──────────┬──────────┬─────────────┬─────────┐
│ Type     │ Assignee  │ Status      │ Progress │ Due Date │ Attachments │ Actions │
├──────────┼───────────┼─────────────┼──────────┼──────────┼─────────────┼─────────┤
│ QT       │ John Doe  │ In Progress │ ████ 75% │ Dec 15   │ 📎 3        │ [Edit]  │
└──────────┴───────────┴─────────────┴──────────┴──────────┴─────────────┴─────────┘
```

### Mobile (<768px)
Stack of cards ordered by priority:
```
┌───────────────────────────────────┐
│ QT               [In Progress]    │  ← Card title with status
├───────────────────────────────────┤
│ Assigned To:      John Doe        │  ← Priority 4
│ Progress:         ████ 75%        │  ← Priority 2
│ Due:              Dec 15, 2024    │  ← Priority 1
│ Files:            📎 3            │  ← Priority 0
│ Actions:          [Edit]          │  ← Priority 0
└───────────────────────────────────┘
```

## Benefits of Migration

### Before (Traditional Table on Mobile)
- ❌ Requires horizontal scrolling
- ❌ Small touch targets (status dropdowns only 140px)
- ❌ Can't see all info without scrolling
- ❌ Progress bars often cut off
- ❌ Hard to tap correct buttons

### After (ResponsiveTable)
- ✅ No horizontal scrolling needed
- ✅ Touch-friendly 44px minimum tap targets
- ✅ All info visible in card view
- ✅ Clear visual hierarchy
- ✅ Easy to scan and interact
- ✅ Card titles for quick identification
- ✅ Clickable cards for navigation
- ✅ Better use of vertical space

## Advanced: Adding Inline Actions on Mobile

For more complex interactions, you can handle mobile differently:

```tsx
const columns: ResponsiveTableColumn<Task>[] = [
  // ... other columns
  {
    key: 'actions',
    header: 'Actions',
    accessor: (task) => {
      // Different actions for mobile vs desktop
      const isMobile = window.innerWidth < 768;
      
      return isMobile ? (
        <div className="flex flex-col gap-2 w-full">
          <Button 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              editTask(task);
            }}
          >
            Edit Task
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              viewAttachments(task);
            }}
          >
            View Files ({task.task_documents?.length || 0})
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" onClick={() => editTask(task)}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => viewAttachments(task)}>
            Files
          </Button>
        </div>
      );
    },
    priority: 0,
  },
];
```

## Migration Checklist

When migrating any table to ResponsiveTable:

- [ ] Define columns array with all table columns
- [ ] Set priorities for mobile ordering (most important = highest number)
- [ ] Identify columns to hide on mobile with `hideOnMobile: true`
- [ ] Add custom `mobileLabel` for columns with long headers
- [ ] Create meaningful `mobileCardTitle` for quick scanning
- [ ] Add `onRowClick` handler if cards should be clickable
- [ ] Test on actual mobile devices
- [ ] Ensure actions work on mobile (stop propagation if needed)
- [ ] Verify touch targets meet 44px minimum
- [ ] Check that all content is readable without horizontal scroll

## Performance Considerations

- ResponsiveTable renders both views but hides one with CSS
- This is intentional to avoid hydration mismatches
- The hidden view has minimal performance impact
- For very large datasets (>1000 rows), consider pagination
- Use React.memo for expensive cell renderers

## When NOT to Use ResponsiveTable

Keep the standard Table component when:
- You have 3 or fewer columns (already mobile-friendly)
- The table is never shown on mobile screens
- You need custom complex interactions that don't fit the card model
- You're implementing a spreadsheet-like interface with inline editing

For these cases, ensure your standard Table component:
- Has proper overflow handling
- Uses appropriate column widths
- Has sticky headers if needed
- Has adequate row padding for touch
