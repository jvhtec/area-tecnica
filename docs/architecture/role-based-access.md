# Role-Based Access Control (RBAC)

## Table of Contents

1. [User Roles Overview](#user-roles-overview)
2. [Permission System](#permission-system)
3. [Role Capabilities Matrix](#role-capabilities-matrix)
4. [Department-Based Access](#department-based-access)
5. [Special Permissions](#special-permissions)
6. [Implementation Details](#implementation-details)
7. [Access Control Functions](#access-control-functions)

---

## User Roles Overview

### Role Definitions

**File**: `src/types/user.ts`

```typescript
type UserRole =
  | 'admin'        // System administrator
  | 'management'   // Business management
  | 'logistics'    // Logistics coordinator
  | 'technician'   // Field technician
  | 'house_tech'   // Venue/House technician
  | 'wallboard'    // Display-only role

interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  department?: Department
  matrixAccess?: 'edit' | 'view' | 'none'
  video_user?: boolean
  active: boolean
  created_at: string
  updated_at: string
}

type Department =
  | 'Sound'
  | 'Light'
  | 'Video'
  | 'Logistics'
```

### Role Hierarchy

```
Admin (highest privileges)
  ↓
Management (business operations)
  ↓
Logistics (resource management)
  ↓
House Tech (department-specific operations)
  ↓
Technician (field work)
  ↓
Wallboard (read-only display)
```

### Role Descriptions

#### Admin
- **Full Access**: Complete system access
- **User Management**: Can create, edit, and delete users
- **System Configuration**: Can modify system settings
- **All Features**: Access to all application features
- **Data Export**: Can export all data
- **Activity Monitoring**: Can view all system activity logs

#### Management
- **Business Operations**: Manage projects, tours, and events
- **Financial Access**: View and manage rates, budgets, and invoices
- **Team Management**: Assign team members to projects
- **Reporting**: Access to business reports and analytics
- **Limited Admin**: Cannot modify system settings or users
- **Multi-Department**: Can view data across all departments

#### Logistics
- **Equipment Management**: Full inventory control
- **Warehouse Operations**: Manage warehouse and storage
- **Vehicle Management**: Track and assign vehicles
- **Resource Planning**: Allocate equipment to events
- **Limited Editing**: Cannot modify tours or projects directly
- **Department Focus**: Primarily logistics-focused access

#### House Tech
- **Department-Specific**: Access limited to own department
- **Event View**: Can view events for their department
- **Equipment View**: Can view department equipment (read-only in logistics)
- **Incident Management**: Can create and manage incidents
- **Schedule View**: Can view and check-in to assigned events
- **Limited Creation**: Cannot create new tours or projects

#### Technician
- **Personal Dashboard**: View own schedule and assignments
- **Event Check-in**: Check in/out of assigned events
- **Incident Reporting**: Create incident reports
- **Equipment View**: View assigned equipment
- **Limited Scope**: Cannot view other users' data
- **Read-Only Tours**: Can view tour details but not edit

#### Wallboard
- **Display Only**: Public display mode for screens
- **No Authentication**: Can access wallboard without login
- **Read-Only**: Cannot interact with any data
- **Limited Data**: Only shows current and upcoming events
- **Auto-Refresh**: Automatically refreshes data

---

## Permission System

### Permission Flags

```typescript
interface PermissionFlags {
  // Special access flags
  matrixAccess: 'edit' | 'view' | 'none'  // Job matrix permissions
  video_user: boolean                      // Video department access

  // Computed permissions (derived from role)
  canManageUsers: boolean
  canManageProjects: boolean
  canManageTours: boolean
  canManageIncidents: boolean
  canManageEquipment: boolean
  canViewFinancials: boolean
  canExportData: boolean
  canViewActivity: boolean
  canManageAnnouncements: boolean
}
```

### Permission Computation

**File**: `src/utils/permissions.ts`

```typescript
export const computePermissions = (user: User): PermissionFlags => {
  const { role, matrixAccess = 'none', video_user = false } = user

  return {
    matrixAccess,
    video_user,

    // User management
    canManageUsers: role === 'admin',

    // Project management
    canManageProjects: ['admin', 'management'].includes(role),

    // Tour management
    canManageTours: ['admin', 'management'].includes(role),

    // Incident management
    canManageIncidents: ['admin', 'management', 'house_tech'].includes(role),

    // Equipment management
    canManageEquipment: ['admin', 'management', 'logistics'].includes(role),

    // Financial access
    canViewFinancials: ['admin', 'management'].includes(role),

    // Data export
    canExportData: ['admin', 'management'].includes(role),

    // Activity logs
    canViewActivity: role === 'admin',

    // Announcements
    canManageAnnouncements: role === 'admin'
  }
}
```

---

## Role Capabilities Matrix

### Feature Access Matrix

| Feature | Admin | Management | Logistics | House Tech | Technician | Wallboard |
|---------|-------|------------|-----------|------------|------------|-----------|
| **Dashboard** | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Availability** | ✅ Edit | ✅ Edit | ❌ | ❌ | ❌ | ❌ |
| **Agenda** | ✅ Edit | ✅ Edit | ❌ | ✅ View | ❌ | ❌ |
| **Projects** | ✅ Edit | ✅ Edit | ❌ | ❌ | ❌ | ❌ |
| **Incidencias** | ✅ Edit | ✅ Edit | ❌ | ✅ Edit | ✅ Own | ❌ |
| **Rates** | ✅ Edit | ✅ Edit | ❌ | ❌ | ❌ | ❌ |
| **Tours** | ✅ Edit | ✅ Edit | ❌ | ✅ View | ✅ View | ❌ |
| **Logistics** | ✅ Edit | ✅ Edit | ✅ Edit | ✅ View | ❌ | ❌ |
| **Festivals** | ✅ Edit | ✅ Edit | ❌ | ✅ View* | ✅ View* | ❌ |
| **Job Matrix** | ✅ Edit | 🔑 | 🔑 | 🔑 | 🔑 | ❌ |
| **Wallboard Mgmt** | ✅ Edit | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Activity Logs** | ✅ View | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Announcements** | ✅ Edit | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Video Dept** | ✅ Edit | 🔑 | 🔑 | 🔑 | 🔑 | ❌ |
| **User Mgmt** | ✅ Edit | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Profile** | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit | ✅ Edit | ❌ |

**Legend:**
- ✅ = Full Access
- ✅ View = Read-only access
- ✅ Own = Only own data
- ✅ View* = Department-specific (Sound only)
- 🔑 = Requires special permission flag
- ❌ = No access

### Data Visibility Matrix

| Data Type | Admin | Management | Logistics | House Tech | Technician |
|-----------|-------|------------|-----------|------------|------------|
| All Users | ✅ | ✅ | ❌ | ❌ | ❌ |
| All Events | ✅ | ✅ | ✅ | 🏢 Dept | 👤 Own |
| All Tours | ✅ | ✅ | ❌ | 🏢 Dept | 👤 Own |
| All Projects | ✅ | ✅ | ❌ | ❌ | ❌ |
| All Incidents | ✅ | ✅ | ❌ | 🏢 Dept | 👤 Own |
| All Equipment | ✅ | ✅ | ✅ | 🏢 Dept | 👤 Assigned |
| Financial Data | ✅ | ✅ | ❌ | ❌ | ❌ |
| Activity Logs | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ = Can view all
- 🏢 Dept = Department-filtered
- 👤 Own = Only own data
- 👤 Assigned = Only assigned items
- ❌ = No access

---

## Department-Based Access

### Department Filtering

When `user.role === 'house_tech'` or `user.role === 'technician'`, data is automatically filtered by department.

```typescript
// Example: Tour filtering for house_tech
const filterToursByDepartment = (tours: Tour[], user: User): Tour[] => {
  if (user.role === 'admin' || user.role === 'management') {
    return tours // No filtering
  }

  if (user.role === 'house_tech' && user.department) {
    return tours.filter(tour =>
      tour.departments.includes(user.department)
    )
  }

  if (user.role === 'technician' && user.department) {
    return tours.filter(tour =>
      tour.departments.includes(user.department) &&
      tour.team_members.some(member => member.user_id === user.id)
    )
  }

  return []
}
```

### Department Override Rules

#### Festivals
- **Default Access**: `admin`, `management`
- **Department Override**: Users with `department === 'Sound'` get access
  - `house_tech` (Sound) → View access
  - `technician` (Sound) → Limited view access

```typescript
// In ProtectedRoute for festivals
const hasFestivalAccess = (user: User): boolean => {
  // Admin and management always have access
  if (['admin', 'management'].includes(user.role)) return true

  // Sound department override
  if (user.department === 'Sound') {
    return ['house_tech', 'technician'].includes(user.role)
  }

  return false
}
```

---

## Special Permissions

### Matrix Access

**Permission Flag**: `user.matrixAccess`
**Values**: `'edit'`, `'view'`, `'none'`

```typescript
// Job Matrix access rules
const canAccessMatrix = (user: User): boolean => {
  if (user.role === 'admin') return true
  return user.matrixAccess !== 'none'
}

const canEditMatrix = (user: User): boolean => {
  if (user.role === 'admin') return true
  return user.matrixAccess === 'edit'
}
```

**Usage in Component**:
```typescript
const JobMatrixPage: React.FC = () => {
  const { user } = useAuth()

  const canEdit = canEditMatrix(user)
  const canView = canAccessMatrix(user)

  return (
    <MatrixGrid
      cells={cells}
      onCellClick={canEdit ? handleCellClick : undefined}
      readOnly={!canEdit}
    />
  )
}
```

### Video User Access

**Permission Flag**: `user.video_user`
**Type**: `boolean`

```typescript
// Video department access
const canAccessVideo = (user: User): boolean => {
  if (user.role === 'admin') return true
  return user.video_user === true
}
```

**Route Protection**:
```typescript
{
  path: 'video',
  element: <ProtectedRoute requireVideoAccess />,
  children: [
    {
      index: true,
      element: <VideoPage />
    }
  ]
}
```

---

## Implementation Details

### Auth Context

**File**: `src/hooks/useOptimizedAuth.tsx:50`

```typescript
interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  permissions: PermissionFlags
}

export const AuthProvider: React.FC = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Compute permissions whenever user changes
  const permissions = useMemo(() => {
    if (!user) return getDefaultPermissions()
    return computePermissions(user)
  }, [user])

  // ... auth logic

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut, permissions }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### useAuth Hook

```typescript
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### useRoleGuard Hook

**File**: `src/hooks/useRoleGuard.tsx`

```typescript
export const useRoleGuard = (allowedRoles: UserRole[]) => {
  const { user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!user) return

    if (!allowedRoles.includes(user.role)) {
      toast.error('No tienes permisos para acceder a esta página')
      navigate('/')
    }
  }, [user, allowedRoles, navigate])

  return {
    hasAccess: user ? allowedRoles.includes(user.role) : false
  }
}
```

---

## Access Control Functions

**File**: `src/utils/permissions.ts`

### Permission Check Functions

```typescript
// User Management
export const canManageUsers = (user: User): boolean => {
  return user.role === 'admin'
}

// Project Management
export const canCreateProject = (user: User): boolean => {
  return ['admin', 'management'].includes(user.role)
}

export const canEditProject = (user: User, project: Project): boolean => {
  if (user.role === 'admin') return true
  if (user.role === 'management') return true
  return false
}

export const canDeleteProject = (user: User, project: Project): boolean => {
  return user.role === 'admin'
}

// Tour Management
export const canCreateTour = (user: User): boolean => {
  return ['admin', 'management'].includes(user.role)
}

export const canEditTour = (user: User, tour: Tour): boolean => {
  if (user.role === 'admin') return true
  if (user.role === 'management') return true
  return false
}

export const canViewTour = (user: User, tour: Tour): boolean => {
  if (['admin', 'management'].includes(user.role)) return true

  // Check if user is in tour's departments
  if (user.department && tour.departments.includes(user.department)) {
    return ['house_tech', 'technician'].includes(user.role)
  }

  return false
}

// Incident Management
export const canCreateIncident = (user: User): boolean => {
  return ['admin', 'management', 'house_tech', 'technician'].includes(user.role)
}

export const canEditIncident = (user: User, incident: Incident): boolean => {
  if (['admin', 'management'].includes(user.role)) return true
  if (user.role === 'house_tech' && user.department === incident.department) return true
  return false
}

export const canViewIncident = (user: User, incident: Incident): boolean => {
  if (['admin', 'management'].includes(user.role)) return true
  if (user.role === 'house_tech' && user.department === incident.department) return true
  if (user.role === 'technician' && incident.assigned_to === user.id) return true
  return false
}

// Equipment Management
export const canManageEquipment = (user: User): boolean => {
  return ['admin', 'management', 'logistics'].includes(user.role)
}

export const canViewEquipment = (user: User, item: EquipmentItem): boolean => {
  if (['admin', 'management', 'logistics'].includes(user.role)) return true
  if (user.role === 'house_tech' && user.department === item.department) return true
  return false
}

// Financial Data
export const canViewFinancials = (user: User): boolean => {
  return ['admin', 'management'].includes(user.role)
}

export const canEditRates = (user: User): boolean => {
  return ['admin', 'management'].includes(user.role)
}

// Festival Access
export const canAccessFestivals = (user: User): boolean => {
  if (['admin', 'management'].includes(user.role)) return true
  if (user.department === 'Sound') {
    return ['house_tech', 'technician'].includes(user.role)
  }
  return false
}

// Matrix Access
export const canViewMatrix = (user: User): boolean => {
  if (user.role === 'admin') return true
  return user.matrixAccess !== 'none'
}

export const canEditMatrix = (user: User): boolean => {
  if (user.role === 'admin') return true
  return user.matrixAccess === 'edit'
}

// Video Access
export const canAccessVideo = (user: User): boolean => {
  if (user.role === 'admin') return true
  return user.video_user === true
}

// Activity Logs
export const canViewActivityLogs = (user: User): boolean => {
  return user.role === 'admin'
}

// Announcements
export const canManageAnnouncements = (user: User): boolean => {
  return user.role === 'admin'
}

// Data Export
export const canExportData = (user: User): boolean => {
  return ['admin', 'management'].includes(user.role)
}
```

### Usage in Components

```typescript
// Example 1: Conditional rendering
const ProjectsPage: React.FC = () => {
  const { user, permissions } = useAuth()

  return (
    <div>
      <PageHeader
        title="Proyectos"
        actions={
          permissions.canManageProjects && (
            <Button onClick={handleNewProject}>
              Nuevo Proyecto
            </Button>
          )
        }
      />

      <ProjectsTable
        projects={projects}
        editable={permissions.canManageProjects}
      />
    </div>
  )
}

// Example 2: Row-level actions
const ProjectRow: React.FC<{ project: Project }> = ({ project }) => {
  const { user } = useAuth()

  return (
    <TableRow>
      <TableCell>{project.name}</TableCell>
      <TableCell>
        <ActionsDropdown>
          <DropdownItem onClick={handleView}>Ver</DropdownItem>
          {canEditProject(user, project) && (
            <DropdownItem onClick={handleEdit}>Editar</DropdownItem>
          )}
          {canDeleteProject(user, project) && (
            <DropdownItem onClick={handleDelete}>Eliminar</DropdownItem>
          )}
        </ActionsDropdown>
      </TableCell>
    </TableRow>
  )
}

// Example 3: Department filtering
const ToursPage: React.FC = () => {
  const { user } = useAuth()
  const { data: allTours } = useTours()

  const tours = useMemo(() => {
    if (user.role === 'admin' || user.role === 'management') {
      return allTours
    }

    if (user.role === 'house_tech' && user.department) {
      return allTours.filter(tour =>
        tour.departments.includes(user.department)
      )
    }

    if (user.role === 'technician' && user.department) {
      return allTours.filter(tour =>
        tour.departments.includes(user.department) &&
        tour.team_members.some(member => member.user_id === user.id)
      )
    }

    return []
  }, [allTours, user])

  return <ToursGrid tours={tours} />
}
```

---

## Security Considerations

### Client-Side vs Server-Side

⚠️ **Important**: All access control checks on the client are for UX purposes only. Always enforce permissions on the server/database level.

### Database Row-Level Security (RLS)

**File**: Supabase RLS policies

```sql
-- Example: Tours table RLS
CREATE POLICY "Users can view tours based on role"
ON tours FOR SELECT
USING (
  -- Admin and management see all
  auth.uid() IN (
    SELECT id FROM users WHERE role IN ('admin', 'management')
  )
  OR
  -- House tech sees tours in their department
  (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'house_tech'
    )
    AND
    department = (SELECT department FROM users WHERE id = auth.uid())
  )
  OR
  -- Technician sees tours they're assigned to
  (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'technician'
    )
    AND
    id IN (
      SELECT tour_id FROM tour_team_members WHERE user_id = auth.uid()
    )
  )
);
```

### API Route Protection

```typescript
// Example: API route protection
export const getTours = async (req: Request, res: Response) => {
  const { user } = req.auth

  // Verify user is authenticated
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Verify user has access to tours
  if (!['admin', 'management', 'house_tech', 'technician'].includes(user.role)) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Apply role-based filtering
  let query = supabase.from('tours').select('*')

  if (user.role === 'house_tech' && user.department) {
    query = query.contains('departments', [user.department])
  }

  if (user.role === 'technician') {
    query = query.in('id', await getUserTourIds(user.id))
  }

  const { data, error } = await query

  return res.json(data)
}
```

---

## Testing Access Control

### Test Cases

```typescript
describe('RBAC Tests', () => {
  describe('Admin Role', () => {
    it('should have access to all routes', () => {
      const admin = { role: 'admin' } as User
      expect(canAccessRoute(admin, '/admin/users')).toBe(true)
      expect(canAccessRoute(admin, '/projects')).toBe(true)
      expect(canAccessRoute(admin, '/matrix')).toBe(true)
    })

    it('should be able to manage all resources', () => {
      const admin = { role: 'admin' } as User
      expect(canManageUsers(admin)).toBe(true)
      expect(canManageProjects(admin)).toBe(true)
      expect(canManageTours(admin)).toBe(true)
    })
  })

  describe('House Tech Role', () => {
    it('should only see department tours', () => {
      const houseTech = {
        role: 'house_tech',
        department: 'Sound'
      } as User

      const soundTour = { departments: ['Sound'] } as Tour
      const lightTour = { departments: ['Light'] } as Tour

      expect(canViewTour(houseTech, soundTour)).toBe(true)
      expect(canViewTour(houseTech, lightTour)).toBe(false)
    })

    it('should have read-only logistics access', () => {
      const houseTech = { role: 'house_tech' } as User
      expect(canAccessRoute(houseTech, '/logistics')).toBe(true)
      expect(canManageEquipment(houseTech)).toBe(false)
    })
  })

  describe('Technician Role', () => {
    it('should only see assigned tours', () => {
      const technician = { id: 'tech-1', role: 'technician' } as User

      const assignedTour = {
        team_members: [{ user_id: 'tech-1' }]
      } as Tour

      const unassignedTour = {
        team_members: [{ user_id: 'tech-2' }]
      } as Tour

      expect(canViewTour(technician, assignedTour)).toBe(true)
      expect(canViewTour(technician, unassignedTour)).toBe(false)
    })
  })
})
```

---

## Component-Level Permissions Reference

This section provides a comprehensive breakdown of component-level permissions throughout the application.

### Department Pages

| Page | Create Job | Edit Job | Delete Job | Assign Personnel | Upload Docs | View Details |
|------|------------|----------|------------|------------------|-------------|--------------|
| **Sound** | Admin+Mgmt 🔒 | Admin+Mgmt 🔒 | Admin+Mgmt 🔒 | Admin+Mgmt+Log 🔒 | Admin+Mgmt+Log 🔒 | All ✅ |
| **Lights** | Admin+Mgmt 🔒 | Admin+Mgmt 🔒 | Admin+Mgmt 🔒 | Admin+Mgmt+Log 🔒 | Admin+Mgmt+Log 🔒 | All ✅ |
| **Video** | Admin+Mgmt 🔒 | Admin+Mgmt 🔒 | ⚠️ All (BUG) | Admin+Mgmt+Log 🔒 | Admin+Mgmt+Log 🔒 | All ✅ |

**⚠️ Security Issue**: Video page delete has no permission check (`src/pages/Video.tsx:128-151`)

### Personal/House Tech Calendar Permissions

**File**: `src/pages/Personal.tsx`

| Feature | Admin | Management | House Tech | Technician | Logistics |
|---------|-------|------------|------------|------------|-----------|
| **Access Page** | ✅ | ✅ | ✅ | ❌ (redirected) | ❌ |
| **View Calendar** | ✅ | ✅ | ✅ Read-only | ❌ | ❌ |
| **Edit Calendar Dates** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Vacation Requests** | ✅ | ✅ | ✅ Own only | ❌ | ❌ |
| **Submit Vacation Request** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Approve/Reject Vacation** | ✅ | ✅ | ❌ | ❌ | ❌ |

**Permission Check** (line 79):
```typescript
canEditDates = userRole === 'admin' || userRole === 'management'
```

### Project Management Page Permissions

**File**: `src/pages/ProjectManagement.tsx`

| Feature | Admin | Management | Logistics | House Tech | Technician |
|---------|-------|------------|-----------|------------|------------|
| **Access Page** | ✅ | ✅ | ✅ | ❌ | ✅ View festivals |
| **Create Items** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Auto-complete Jobs** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Tasks Button** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **WhatsApp Group** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Almacén Message** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Manage Festival** | ✅ | ✅ | ✅ | 👁️ View | 👁️ View |
| **Assign Personnel** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Calculators (Pesos/Consumos)** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Incident Report** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Flex Folders** | ✅ | ✅ | ✅ | ❌ | ❌ |

**Permission Check** (line 76):
```typescript
canCreateItems = ['admin', 'management', 'logistics'].includes(userRole)
```

### Festival Management Permissions

**File**: `src/pages/FestivalManagement.tsx`

| Feature | Admin | Management | Logistics | House Tech (Sound) | Technician (Sound) |
|---------|-------|------------|-----------|-------------------|-------------------|
| **Access Page** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Add Artist** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Edit Artist** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Artist** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Upload Documents** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Documents** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Sync to Flex** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Festival Data** | ✅ | ✅ | ✅ | ✅ Read-only | ✅ Read-only |
| **Calculators** | ❌ | ✅ | ❌ | ❌ | ❌ |

**Access Rule**: Sound department house_tech and technician get view-only access

### User Management Permissions

**File**: `src/components/users/EditUserDialog.tsx`

#### Field-Level Permissions

| Field | All Management Users | Management Only (Special) |
|-------|---------------------|---------------------------|
| Basic Info (Name, Phone, DNI) | ✅ | |
| Department, Role | ✅ | |
| Assignable as Tech | ✅ | |
| Autónomo (if technician) | ✅ | |
| **SoundVision Access** | | ✅ (lines 158-175) |
| **Flex Resource ID** | | ✅ (lines 194-247) |
| **Flex URL Extract Helper** | | ✅ (lines 194-247) |
| **House Tech Rate Editor** | | ✅ (lines 334-343) |
| **Send Onboarding Email** | | ✅ (lines 316-326) |

**Permission Check** (lines 30-31):
```typescript
const isManagementUser = ['admin', 'management'].includes(userRole || '')
```

**Special Behavior**:
- **Sound House Tech**: SoundVision access force-enabled (cannot disable)
- **Sound Technician**: SoundVision access is editable toggle

**File**: `src/components/users/UsersListContent.tsx`

| Action | Admin | Management | Others |
|--------|-------|------------|--------|
| **View Users** | ✅ | ✅ | ❌ |
| **Edit User** | ✅ | ✅ | ❌ |
| **Manage Skills** | ✅ | ✅ (if isManagementUser) | ❌ |
| **Delete User** | ✅ | ❌ | ❌ |

**Manage Skills Button** (lines 55, 112):
- Only shown when `isManagementUser === true`

### SoundVision Files Permissions

**File**: `src/components/soundvision/SoundVisionFilesList.tsx`

| Action | Admin | Management | Logistics | House Tech | Technician |
|--------|-------|------------|-----------|------------|------------|
| **Access Page** | ✅ | ✅ | ✅ (if has SV access) | ✅ (if has SV access) | ✅ (if has SV access) |
| **Upload Files** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Download Files** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Delete Files** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Review (Always)** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Review (After Download)** | ✅ | ✅ | ✅ | ✅ | ✅ |

**Permission Checks** (lines 40-74):
```typescript
const canDelete = canDeleteSoundVisionFiles(profile?.role)  // [Admin+Mgmt]
const isManagement = profile?.role === 'admin' || profile?.role === 'management'
const canOpenReviews = (file: SoundVisionFile) =>
  isManagement || file.hasDownloaded || file.hasReviewed
```

**Review Access Rules**:
- **Management**: Always enabled
- **Others**: Must download file first (tooltip shown when disabled)

### Job Card Actions Component Permissions

**File**: `src/components/jobs/cards/JobCardActions.tsx`

This is a critical shared component with extensive conditional rendering:

| Button/Action | Permission Check | Line Numbers |
|---------------|------------------|--------------|
| **Tasks** | `isProjectManagementPage && job_type !== 'dryhire'` | 731-742 |
| **WhatsApp Group** | `isProjectManagementPage && (admin\|\|mgmt) && job_type not in ['tourdate','dryhire']` | 754-766 |
| **Almacén Message** | `isProjectManagementPage && (admin\|\|mgmt)` | 767-782 |
| **View Details** | `onJobDetailsClick provided` (All) | 784-794 |
| **Manage Festival** | `job_type==='festival' && isProjectManagementPage && canManageArtists` | 796-807 |
| **Manage Job** | `job_type not in ['festival','dryhire'] && isProjectManagementPage && canManageArtists` | 808-819 |
| **Assign** | `!isHouseTech && job_type !== 'dryhire' && isProjectManagementPage` | 820-831 |
| **Refresh** | Always shown (All) | 832-839 |
| **Timesheet** | `job_type not in ['dryhire','tourdate']` (All) | 852-862 |
| **Calculators** | `isProjectManagementPage && userRole === 'management'` | 864-889 |
| **Technician Incident** | `userRole === 'technician' && job_type !== 'dryhire'` | 890-895 |
| **Edit/Delete** | `canEditJobs` (Admin+Mgmt) | 896-916 |
| **Flex Folder** | `canCreateFlexFolders` (Admin+Mgmt+Log) | 917-971 |
| **Create Local Folders** | Always shown (All) | 972-989 |
| **Archive** | `job_type !== 'dryhire'` (All) | 991-1002 |
| **Backfill** | Always shown (All) | 1004-1013 |
| **Upload Documents** | `canUploadDocuments && showUpload && job_type !== 'dryhire'` | 1014-1026 |

**Props Interface** (lines 83-122):
```typescript
interface JobCardActionsProps {
  userRole: string | null
  canEditJobs: boolean           // [Admin+Mgmt]
  canCreateFlexFolders: boolean  // [Admin+Mgmt+Log]
  canUploadDocuments: boolean    // [Admin+Mgmt+Log]
  canManageArtists: boolean      // [All except wallboard]
  isHouseTech: boolean           // Hides assign button
  isProjectManagementPage: boolean
}
```

### Dialog/Modal Permissions Summary

| Dialog Name | Access Roles | Special Conditions |
|-------------|--------------|-------------------|
| **CreateJobDialog** | Admin, Management | Used in Sound/Lights/Video pages |
| **EditJobDialog** | Admin, Management | Via canEditJobs prop |
| **DeleteConfirmDialog** | Admin, Management | Via canEditJobs prop |
| **AssignPersonnelDialog** | Admin, Management, Logistics | Hidden for house_tech |
| **TaskManagerDialog** | Admin, Management, Logistics | job_type !== 'dryhire' |
| **TechnicianIncidentDialog** | Technician only | job_type !== 'dryhire' |
| **VacationRequestDialog** | Admin, Management, House Tech | |
| **EditUserDialog** | Admin, Management | Field-level permissions vary |
| **ManageSkillsDialog** | Admin, Management | When isManagementUser=true |
| **SendEmailConfirmDialog** | Admin, Management | Management users only |
| **UploadDocumentsDialog** | Admin, Management, Logistics | job_type !== 'dryhire' |
| **PesosCalculatorDialog** | Management only | Project Management context |
| **ConsumosCalculatorDialog** | Management only | Project Management context |
| **SVReviewDialog** | Conditional | Management always; others after download |
| **ArchiveToFlexDialog** | All | job_type !== 'dryhire' |

### Permission Utility Functions

**File**: `src/utils/permissions.ts`

Complete list of permission check functions:

```typescript
// User/Role Checks
- isTechnicianRole(role): boolean
- canViewDetails(role): boolean  // Always true

// Job Management
- canEditJobs(role): boolean  // admin, management, logistics
- canAssignPersonnel(role): boolean  // admin, management, logistics

// Document Management
- canUploadDocuments(role): boolean  // admin, management, logistics
- canDeleteDocuments(role): boolean  // admin, management
- canCreateFolders(role): boolean  // admin, management, logistics

// Festival Management
- canManageFestivalArtists(role): boolean  // all except wallboard

// SoundVision
- canUploadSoundVisionFiles(role): boolean  // admin, mgmt, log, ht, tech
- canDeleteSoundVisionFiles(role): boolean  // admin, management
```

### Special Permission Flags

#### soundvision_access_enabled

**Behavior**:
- **Automatic**: Sound House Techs always have access (force-enabled)
- **Manual**: Sound Technicians can be granted access
- **Request**: Other users can request access

**Grants Access To**:
- SoundVision files page
- Upload SoundVision files
- Download and review files

#### matrixAccess

**Values**: `'edit'` | `'view'` | `'none'`

**Behavior**:
- **Admin**: Always has full access regardless of flag
- **Others**: Determined by flag value
  - `'edit'`: Can modify job matrix
  - `'view'`: Read-only access to job matrix
  - `'none'`: No access to job matrix

#### video_user

**Values**: `boolean`

**Behavior**:
- **Admin**: Always has access regardless of flag
- **Others**: Must have flag set to `true` to access video features

### Complete CRUD Permissions Matrix

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| **Jobs** | Admin, Mgmt | All (dept-filtered) | Admin, Mgmt | Admin, Mgmt (⚠️ except Video page) |
| **Job Assignments** | Admin, Mgmt, Log | All | Admin, Mgmt, Log | Admin, Mgmt, Log |
| **Festival Artists** | Admin, Mgmt, Log | All with fest access | Admin, Mgmt, Log | Admin, Mgmt |
| **Documents** | Admin, Mgmt, Log | All | Admin, Mgmt, Log | Admin, Mgmt |
| **SoundVision Files** | All with SV access | All with SV access | All with SV access | Admin, Mgmt |
| **Users** | Admin | Admin, Mgmt | Admin, Mgmt | Admin |
| **Vacation Requests** | Admin, Mgmt, HT | Admin, Mgmt, HT | Admin, Mgmt | Admin, Mgmt |
| **User Skills** | Admin, Mgmt | Admin, Mgmt | Admin, Mgmt | Admin, Mgmt |
| **House Tech Rates** | Admin, Mgmt | Admin, Mgmt | Admin, Mgmt | Admin, Mgmt |

### Known Limitations & Security Issues

1. **Video Page Delete (Critical)** ⚠️
   - File: `src/pages/Video.tsx:128-151`
   - Issue: No permission check
   - Impact: Any authenticated user can delete video jobs
   - Fix: Add same permission check as Sound/Lights pages

2. **Client-Side Only Checks**
   - All permission checks are client-side
   - Must be enforced server-side with RLS policies
   - Client checks are for UX, not security

3. **Job Type Conditional Logic**
   - Many features check `job_type !== 'dryhire'`
   - This is a business rule, not a permission
   - Still affects UI rendering

---

## Key Files Reference

- **User Types**: `src/types/user.ts:1`
- **Role Types**: `src/types/roles.ts:1`
- **Auth Provider**: `src/hooks/useOptimizedAuth.tsx:50`
- **Permissions Utils**: `src/utils/permissions.ts:1`
- **Role-based Routing**: `src/utils/roleBasedRouting.ts:1`
- **Protected Route**: `src/components/ProtectedRoute.tsx:1`
- **Role Guard Hook**: `src/hooks/useRoleGuard.tsx:1`
- **User Role Context**: `src/contexts/UserRoleContext.tsx:1`

### Component Files with Permissions

- **Job Card Actions**: `src/components/jobs/cards/JobCardActions.tsx` (100+ conditional renders)
- **Edit User Dialog**: `src/components/users/EditUserDialog.tsx` (field-level permissions)
- **Users List**: `src/components/users/UsersListContent.tsx` (action permissions)
- **SoundVision Files**: `src/components/soundvision/SoundVisionFilesList.tsx` (download-gated reviews)
- **Sound Page**: `src/pages/Sound.tsx` (job management)
- **Lights Page**: `src/pages/Lights.tsx` (job management)
- **Video Page**: `src/pages/Video.tsx` (⚠️ has security issue)
- **Personal Calendar**: `src/pages/Personal.tsx` (calendar edit permissions)
- **Project Management**: `src/pages/ProjectManagement.tsx` (extensive permissions)
- **Festival Management**: `src/pages/FestivalManagement.tsx` (dept override)
