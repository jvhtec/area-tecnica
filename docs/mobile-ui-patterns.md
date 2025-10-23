# Mobile-Responsive UI Patterns

This guide documents the mobile-responsive patterns and enhancements made to Sector Pro's UI components. All components now support touch-friendly interactions and responsive layouts optimized for mobile devices.

## Core Principles

1. **Touch Targets**: Minimum 44px tap targets on mobile (Apple/Google recommendation)
2. **Responsive Typography**: Base text on mobile (16px), smaller on desktop to prevent zoom
3. **Adaptive Spacing**: More generous padding on mobile to prevent accidental taps
4. **Stacking Layouts**: Components stack vertically on mobile, horizontal on desktop
5. **Mobile-First Data Display**: Complex tables convert to card layouts on small screens

## Breakpoints

Following Tailwind's default breakpoint system:
- `sm`: 640px (small tablets and up)
- `md`: 768px (tablets and up) - **Primary mobile breakpoint**
- `lg`: 1024px (laptops and up)

Most components use `md:` as the transition point from mobile to desktop.

## Component Enhancements

### Card Components

Cards now use responsive padding and typography:

```tsx
// Before
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// No changes needed - responsive by default
// Mobile: p-4, Desktop: p-6
// Title: text-xl on mobile, text-2xl on desktop
```

**Mobile Optimizations:**
- Reduced padding: `p-4` on mobile, `p-6` on desktop
- Smaller title size: `text-xl` on mobile, `text-2xl` on desktop
- Gap spacing in CardFooter for proper button spacing

### Tabs

Tabs have larger touch targets and better spacing:

```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Content</TabsContent>
</Tabs>
```

**Mobile Optimizations:**
- Minimum 44px touch target height
- Larger text: `text-base` on mobile, `text-sm` on desktop
- Increased padding: `px-4 py-2` on mobile, `px-3 py-1.5` on desktop
- TabsList height: `h-12` on mobile, `h-10` on desktop

### Dialogs

Dialogs are sized appropriately for mobile screens:

```tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Title</DialogTitle>
      <DialogDescription>Description</DialogDescription>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

**Mobile Optimizations:**
- Width: `calc(100% - 2rem)` on mobile (full width with margins)
- Max height: `90vh` with scroll on mobile
- Padding: `p-4` on mobile, `p-6` on desktop
- Larger close button: 32px × 32px on mobile
- Larger X icon: 20px on mobile, 16px on desktop

### Sheets

Side sheets take appropriate width on mobile:

```tsx
<Sheet>
  <SheetTrigger asChild>
    <Button>Open Sheet</Button>
  </SheetTrigger>
  <SheetContent side="right">
    {/* Content */}
  </SheetContent>
</Sheet>
```

**Mobile Optimizations:**
- Width: 85% of screen on mobile, max-w-sm on desktop
- Padding: `p-4` on mobile, `p-6` on desktop
- Larger close button with better touch target

### Buttons

Buttons have touch-friendly sizes:

```tsx
<Button>Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon"><Icon /></Button>
```

**Mobile Optimizations:**
- Default: `min-h-[44px]` on mobile, `h-10` on desktop
- Large: `min-h-[48px]` on mobile, `h-11` on desktop
- Icon: `min-h-[44px] min-w-[44px]` on mobile
- Text: `text-base` on mobile, `text-sm` on desktop

### Form Controls

#### Input

```tsx
<Input type="text" placeholder="Enter text" />
<Input type="email" placeholder="Email" />
```

**Mobile Optimizations:**
- Height: `min-h-[44px]` on mobile, `h-10` on desktop
- Text size: `text-base` on mobile (prevents zoom), `text-sm` on desktop

#### Select

```tsx
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Option 1</SelectItem>
    <SelectItem value="2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

**Mobile Optimizations:**
- Trigger height: `min-h-[44px]` on mobile
- Text size: `text-base` on mobile, `text-sm` on desktop
- Item height: `min-h-[44px]` on mobile for easy tapping
- Larger padding: `py-2` on mobile, `py-1.5` on desktop

#### Textarea

```tsx
<Textarea placeholder="Enter description" />
```

**Mobile Optimizations:**
- Min height: `100px` on mobile, `80px` on desktop
- Text size: `text-base` on mobile, `text-sm` on desktop

#### Date-Time Picker

```tsx
<DateTimePicker
  value={date}
  onChange={setDate}
  timezone="Europe/Madrid"
/>
```

**Mobile Optimizations:**
- Stacked layout on mobile (vertical)
- Full width inputs on mobile
- Horizontal layout on desktop

### Form Labels and Messages

```tsx
<FormItem>
  <FormLabel>Field Label</FormLabel>
  <FormControl>
    <Input />
  </FormControl>
  <FormDescription>Helper text</FormDescription>
  <FormMessage />
</FormItem>
```

**Mobile Optimizations:**
- Labels: `text-base` on mobile, `text-sm` on desktop
- Description: `text-sm` on mobile, `text-xs` on desktop
- Error messages: Better line-height for readability

### Tables

Standard tables now have better mobile scroll and spacing:

```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Column 1</TableHead>
      <TableHead>Column 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Data 1</TableCell>
      <TableCell>Data 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

**Mobile Optimizations:**
- Padding: `p-3` on mobile, `p-4` on desktop
- Smaller text with whitespace-nowrap on headers
- Horizontal scroll enabled by default

## Responsive Table Component

For complex tables with many columns, use `ResponsiveTable` which converts to cards on mobile:

### Basic Example

```tsx
import { ResponsiveTable, ResponsiveTableColumn } from '@/components/shared/ResponsiveTable'

interface Task {
  id: string
  title: string
  assignee: string
  status: 'pending' | 'in_progress' | 'completed'
  dueDate: Date
}

const columns: ResponsiveTableColumn<Task>[] = [
  {
    key: 'title',
    header: 'Task',
    accessor: (task) => task.title,
    priority: 3, // Shows first on mobile
  },
  {
    key: 'assignee',
    header: 'Assigned To',
    accessor: (task) => task.assignee,
    priority: 2,
  },
  {
    key: 'status',
    header: 'Status',
    accessor: (task) => (
      <Badge variant={getStatusVariant(task.status)}>
        {task.status}
      </Badge>
    ),
    priority: 1,
  },
  {
    key: 'dueDate',
    header: 'Due Date',
    accessor: (task) => format(task.dueDate, 'PP'),
    hideOnMobile: true, // Only show on desktop
  },
]

function TaskTable({ tasks }: { tasks: Task[] }) {
  return (
    <ResponsiveTable
      data={tasks}
      columns={columns}
      keyExtractor={(task) => task.id}
      onRowClick={(task) => router.push(`/tasks/${task.id}`)}
      mobileCardTitle={(task) => task.title}
      emptyMessage="No tasks found"
      breakpoint="md"
    />
  )
}
```

### Desktop View (≥768px)
Renders as a traditional table with all columns visible.

### Mobile View (<768px)
Renders as a stack of cards:
```
┌──────────────────────────┐
│ Task Title               │
├──────────────────────────┤
│ Task: Fix bug in login   │
│ Assigned To: John Doe    │
│ Status: [In Progress]    │
└──────────────────────────┘
```

### Advanced Features

#### Column Priority
Controls the order of fields in mobile card view:
```tsx
{
  key: 'field',
  header: 'Field',
  accessor: (item) => item.field,
  priority: 5, // Higher = appears first on mobile
}
```

#### Hide Columns on Mobile
Remove less critical columns on small screens:
```tsx
{
  key: 'metadata',
  header: 'Metadata',
  accessor: (item) => item.metadata,
  hideOnMobile: true, // Only visible on desktop
}
```

#### Custom Mobile Labels
Use shorter labels for mobile:
```tsx
{
  key: 'description',
  header: 'Full Description Text',
  mobileLabel: 'Desc', // Shorter on mobile
  accessor: (item) => item.description,
}
```

#### Custom Card Titles
Add a prominent title to each mobile card:
```tsx
<ResponsiveTable
  data={items}
  columns={columns}
  keyExtractor={(item) => item.id}
  mobileCardTitle={(item) => (
    <div className="flex items-center gap-2">
      <Avatar src={item.avatar} />
      <span>{item.name}</span>
    </div>
  )}
/>
```

## Migration Examples

### Migrating a Simple Table

**Before:**
```tsx
<div className="border rounded">
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Name</TableHead>
        <TableHead>Email</TableHead>
        <TableHead>Role</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      {users.map((user) => (
        <TableRow key={user.id}>
          <TableCell>{user.name}</TableCell>
          <TableCell>{user.email}</TableCell>
          <TableCell>{user.role}</TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</div>
```

**After:**
```tsx
<ResponsiveTable
  data={users}
  columns={[
    {
      key: 'name',
      header: 'Name',
      accessor: (user) => user.name,
      priority: 3,
    },
    {
      key: 'email',
      header: 'Email',
      accessor: (user) => user.email,
      priority: 2,
    },
    {
      key: 'role',
      header: 'Role',
      accessor: (user) => user.role,
      priority: 1,
    },
  ]}
  keyExtractor={(user) => user.id}
  mobileCardTitle={(user) => user.name}
/>
```

### Migrating a Complex Table with Actions

**Before:**
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Job</TableHead>
      <TableHead>Client</TableHead>
      <TableHead>Date</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Budget</TableHead>
      <TableHead>Crew Size</TableHead>
      <TableHead>Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {jobs.map((job) => (
      <TableRow key={job.id}>
        <TableCell>{job.name}</TableCell>
        <TableCell>{job.client}</TableCell>
        <TableCell>{format(job.date, 'PP')}</TableCell>
        <TableCell><Badge>{job.status}</Badge></TableCell>
        <TableCell>{job.budget}</TableCell>
        <TableCell>{job.crewSize}</TableCell>
        <TableCell>
          <Button size="sm">Edit</Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

**After:**
```tsx
<ResponsiveTable
  data={jobs}
  columns={[
    {
      key: 'name',
      header: 'Job',
      accessor: (job) => job.name,
      priority: 5,
    },
    {
      key: 'client',
      header: 'Client',
      accessor: (job) => job.client,
      priority: 4,
    },
    {
      key: 'date',
      header: 'Date',
      accessor: (job) => format(job.date, 'PP'),
      priority: 3,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (job) => <Badge>{job.status}</Badge>,
      priority: 2,
    },
    {
      key: 'budget',
      header: 'Budget',
      accessor: (job) => job.budget,
      hideOnMobile: true, // Hide less critical info on mobile
    },
    {
      key: 'crewSize',
      header: 'Crew',
      mobileLabel: 'Crew', // Shorter label
      accessor: (job) => job.crewSize,
      priority: 1,
    },
    {
      key: 'actions',
      header: 'Actions',
      accessor: (job) => (
        <Button size="sm" onClick={() => editJob(job)}>
          Edit
        </Button>
      ),
      priority: 0, // Last on mobile
    },
  ]}
  keyExtractor={(job) => job.id}
  onRowClick={(job) => viewJobDetails(job)}
  mobileCardTitle={(job) => (
    <div className="flex items-center justify-between">
      <span>{job.name}</span>
      <Badge variant="outline">{job.status}</Badge>
    </div>
  )}
  emptyMessage="No jobs found"
/>
```

## Best Practices

### Touch Targets
- Always use minimum 44px tap targets on mobile
- Add proper spacing between interactive elements
- Use `min-h-[44px]` for buttons and form controls

### Typography
- Use `text-base` on mobile to prevent browser zoom
- Scale down to `text-sm` on desktop for density
- Keep labels legible with proper contrast

### Layout
- Stack form fields vertically on mobile
- Use `flex-col md:flex-row` for responsive layouts
- Test on actual devices, not just browser resize

### Forms
- Use native input types for better mobile keyboards
- Keep forms short and single-column on mobile
- Use clear, visible error messages

### Tables
- Use `ResponsiveTable` for tables with >4 columns
- Set column priorities thoughtfully
- Hide less important columns on mobile
- Consider card titles for quick scanning

### Testing
Test on multiple devices and screen sizes:
- Mobile: 375px (iPhone SE), 390px (iPhone 12/13), 414px (iPhone Plus)
- Tablet: 768px (iPad), 810px (iPad Portrait)
- Desktop: 1024px+

## Common Patterns

### Responsive Form Layout
```tsx
<form className="space-y-4">
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <FormField name="firstName">
      <FormLabel>First Name</FormLabel>
      <FormControl>
        <Input />
      </FormControl>
    </FormField>
    <FormField name="lastName">
      <FormLabel>Last Name</FormLabel>
      <FormControl>
        <Input />
      </FormControl>
    </FormField>
  </div>
  <FormField name="email">
    <FormLabel>Email</FormLabel>
    <FormControl>
      <Input type="email" />
    </FormControl>
  </FormField>
</form>
```

### Responsive Action Bar
```tsx
<div className="flex flex-col md:flex-row gap-2 md:gap-4 md:items-center md:justify-between">
  <h2 className="text-xl font-semibold">Projects</h2>
  <div className="flex flex-col sm:flex-row gap-2">
    <Button variant="outline">
      <Filter className="h-4 w-4 mr-2" />
      Filter
    </Button>
    <Button>
      <Plus className="h-4 w-4 mr-2" />
      New Project
    </Button>
  </div>
</div>
```

### Responsive Card Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => (
    <Card key={item.id}>
      <CardHeader>
        <CardTitle>{item.title}</CardTitle>
      </CardHeader>
      <CardContent>{item.description}</CardContent>
    </Card>
  ))}
</div>
```

## Additional Resources

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Apple Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/ios/visual-design/adaptivity-and-layout/)
- [Material Design - Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
- [ResponsiveTable Component Documentation](../components/shared/ResponsiveTable.md)
