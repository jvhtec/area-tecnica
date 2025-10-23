# ResponsiveTable Component

A responsive table adapter component that automatically switches between a traditional table layout on larger screens and a stacked card layout on mobile devices.

## Features

- **Automatic Layout Switching**: Displays as a table on desktop and as cards on mobile
- **Configurable Breakpoint**: Choose between `sm`, `md`, or `lg` breakpoints
- **Column Priority**: Control which columns appear first on mobile using the `priority` prop
- **Hide Columns**: Selectively hide columns on mobile with `hideOnMobile`
- **Custom Mobile Labels**: Override column headers for mobile view
- **Touch-Friendly**: Card layout optimized for touch interactions
- **Click Handlers**: Support for row/card click events

## Basic Usage

```tsx
import { ResponsiveTable, ResponsiveTableColumn } from '@/components/shared/ResponsiveTable'

interface User {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
}

const columns: ResponsiveTableColumn<User>[] = [
  {
    key: 'name',
    header: 'Name',
    accessor: (user) => user.name,
    priority: 3, // Highest priority on mobile
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
  {
    key: 'status',
    header: 'Status',
    accessor: (user) => (
      <Badge variant={user.status === 'active' ? 'success' : 'secondary'}>
        {user.status}
      </Badge>
    ),
    hideOnMobile: true, // This column won't show on mobile
  },
]

function UserList() {
  const users: User[] = [
    // ... your data
  ]

  return (
    <ResponsiveTable
      data={users}
      columns={columns}
      keyExtractor={(user) => user.id}
      onRowClick={(user) => console.log('Clicked:', user)}
      emptyMessage="No users found"
      mobileCardTitle={(user) => user.name}
      breakpoint="md"
    />
  )
}
```

## Props

### ResponsiveTableProps

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `data` | `T[]` | Yes | - | Array of data items to display |
| `columns` | `ResponsiveTableColumn<T>[]` | Yes | - | Column definitions |
| `keyExtractor` | `(item: T, index: number) => string \| number` | Yes | - | Function to extract unique key from each item |
| `onRowClick` | `(item: T) => void` | No | - | Callback when a row/card is clicked |
| `emptyMessage` | `string` | No | `"No data available"` | Message shown when data is empty |
| `className` | `string` | No | - | Additional CSS classes for the table wrapper |
| `mobileCardTitle` | `(item: T) => React.ReactNode` | No | - | Function to generate card title on mobile |
| `breakpoint` | `"sm" \| "md" \| "lg"` | No | `"md"` | Screen size breakpoint for switching layouts |

### ResponsiveTableColumn

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `key` | `string` | Yes | - | Unique identifier for the column |
| `header` | `string` | Yes | - | Column header text |
| `accessor` | `(item: T) => React.ReactNode` | Yes | - | Function to extract/render cell content |
| `className` | `string` | No | - | Additional CSS classes for the column |
| `mobileLabel` | `string` | No | Uses `header` | Custom label for mobile view |
| `hideOnMobile` | `boolean` | No | `false` | Whether to hide this column on mobile |
| `priority` | `number` | No | `0` | Higher numbers appear first on mobile |

## Advanced Examples

### With Custom Mobile Labels

```tsx
const columns: ResponsiveTableColumn<Task>[] = [
  {
    key: 'title',
    header: 'Task Title',
    mobileLabel: 'Task', // Shorter label for mobile
    accessor: (task) => task.title,
  },
]
```

### With Different Breakpoint

```tsx
<ResponsiveTable
  // ... other props
  breakpoint="lg" // Only switch to cards below 1024px
/>
```

### With Rich Content

```tsx
const columns: ResponsiveTableColumn<Job>[] = [
  {
    key: 'actions',
    header: 'Actions',
    accessor: (job) => (
      <div className="flex gap-2">
        <Button size="sm" onClick={() => editJob(job)}>Edit</Button>
        <Button size="sm" variant="destructive" onClick={() => deleteJob(job)}>Delete</Button>
      </div>
    ),
    priority: 0, // Show last on mobile
  },
]
```

### Without Click Handlers

```tsx
<ResponsiveTable
  data={data}
  columns={columns}
  keyExtractor={(item) => item.id}
  // No onRowClick - cards won't be clickable
/>
```

## Mobile Optimization Notes

- On mobile, columns are displayed in a label-value format within cards
- Use `priority` to control the order of fields on mobile (higher = first)
- Use `hideOnMobile` to remove less important columns on small screens
- The `mobileCardTitle` prop adds a header to each card for quick identification
- Cards have touch-friendly spacing and are optimized for thumb interaction
- All responsive breakpoints follow Tailwind's default breakpoint system:
  - `sm`: 640px
  - `md`: 768px (default)
  - `lg`: 1024px

## Migration Guide

To migrate from standard Table to ResponsiveTable:

### Before
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {users.map(user => (
      <TableRow key={user.id}>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### After
```tsx
<ResponsiveTable
  data={users}
  columns={[
    { key: 'name', header: 'Name', accessor: (user) => user.name },
    { key: 'email', header: 'Email', accessor: (user) => user.email },
  ]}
  keyExtractor={(user) => user.id}
/>
```
