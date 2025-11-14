# Navigation and Routing Structure

## Table of Contents

1. [Routing Overview](#routing-overview)
2. [Route Definitions](#route-definitions)
3. [Navigation Components](#navigation-components)
4. [Route Protection](#route-protection)
5. [Dynamic Routing](#dynamic-routing)
6. [Breadcrumb Navigation](#breadcrumb-navigation)

---

## Routing Overview

The application uses **React Router v6** for client-side routing.

### Router Structure

```
src/
├── main.tsx                    # Router setup with BrowserRouter
├── App.tsx                     # Route definitions
└── components/
    ├── ProtectedRoute.tsx      # Role-based route protection
    └── layout/
        ├── Layout.tsx          # Main layout wrapper
        └── SidebarNavigation.tsx  # Navigation menu
```

### Route Hierarchy

```
BrowserRouter
 └─ Routes
     ├─ Public Routes (no auth)
     │   ├─ /login → LoginPage
     │   └─ /wallboard → WallboardPage
     │
     └─ Protected Routes (requires auth)
         └─ / → Layout (wrapper)
             ├─ Dashboard Routes
             ├─ Feature Routes
             └─ Admin Routes
```

---

## Route Definitions

**File**: `src/App.tsx`

### Complete Route Map

```typescript
// Public Routes
{
  path: '/login',
  element: <LoginPage />,
  access: 'public'
},
{
  path: '/wallboard',
  element: <WallboardPage />,
  access: 'public'
},

// Protected Routes (wrapped in RequireAuth)
{
  path: '/',
  element: <Layout />,
  children: [
    // Dashboard (role-based routing handled in component)
    {
      path: '/',
      element: <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech', 'technician']} />,
      children: [
        {
          index: true,
          element: <DashboardPage /> // Renders different dashboard based on role
        }
      ]
    },

    // Availability
    {
      path: 'availability',
      element: <ProtectedRoute allowedRoles={['admin', 'management']} />,
      children: [
        {
          index: true,
          element: <AvailabilityPage />
        }
      ]
    },

    // Agenda
    {
      path: 'agenda',
      element: <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech']} />,
      children: [
        {
          index: true,
          element: <AgendaPage />
        }
      ]
    },

    // Projects
    {
      path: 'projects',
      element: <ProtectedRoute allowedRoles={['admin', 'management']} />,
      children: [
        {
          index: true,
          element: <ProjectsPage />
        },
        {
          path: ':projectId',
          element: <ProjectDetailsPage />
        }
      ]
    },

    // Incidencias
    {
      path: 'incidencias',
      element: <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech', 'technician']} />,
      children: [
        {
          index: true,
          element: <IncidenciasPage />
        },
        {
          path: ':incidentId',
          element: <IncidentDetailsPage />
        }
      ]
    },

    // Rates
    {
      path: 'rates',
      element: <ProtectedRoute allowedRoles={['admin', 'management']} />,
      children: [
        {
          index: true,
          element: <RatesPage />
        }
      ]
    },

    // Tours
    {
      path: 'tours',
      element: <ProtectedRoute allowedRoles={['admin', 'management', 'house_tech', 'technician']} />,
      children: [
        {
          index: true,
          element: <ToursPage />
        },
        {
          path: ':tourId',
          element: <TourDetailsPage />
        },
        {
          path: ':tourId/events/:eventId',
          element: <TourEventDetailsPage />
        }
      ]
    },

    // Logistics
    {
      path: 'logistics',
      element: <ProtectedRoute allowedRoles={['admin', 'management', 'logistics', 'house_tech']} />,
      children: [
        {
          index: true,
          element: <LogisticsPage />
        },
        {
          path: 'inventory',
          element: <InventoryPage />
        },
        {
          path: 'inventory/:itemId',
          element: <InventoryItemDetailsPage />
        },
        {
          path: 'warehouse',
          element: <WarehousePage />
        },
        {
          path: 'vehicles',
          element: <VehiclesPage />
        }
      ]
    },

    // Festivals
    {
      path: 'festivals',
      element: <ProtectedRoute allowedRoles={['admin', 'management']} departmentOverride="Sound" />,
      children: [
        {
          index: true,
          element: <FestivalsPage />
        },
        {
          path: ':festivalId',
          element: <FestivalDetailsPage />
        }
      ]
    },

    // Job Matrix
    {
      path: 'matrix',
      element: <ProtectedRoute requireMatrixAccess />,
      children: [
        {
          index: true,
          element: <JobMatrixPage />
        }
      ]
    },

    // Admin Routes
    {
      path: 'admin',
      element: <ProtectedRoute allowedRoles={['admin']} />,
      children: [
        // Wallboard
        {
          path: 'wallboard',
          element: <WallboardManagementPage />
        },
        // Activity Logs
        {
          path: 'activity',
          element: <ActivityPage />
        },
        // Announcements
        {
          path: 'announcements',
          element: <AnnouncementsPage />
        },
        // User Management
        {
          path: 'users',
          element: <UsersPage />
        },
        {
          path: 'users/:userId',
          element: <UserDetailsPage />
        }
      ]
    },

    // Video Department
    {
      path: 'video',
      element: <ProtectedRoute requireVideoAccess />,
      children: [
        {
          index: true,
          element: <VideoPage />
        }
      ]
    },

    // Profile
    {
      path: 'profile',
      element: <ProfilePage /> // All authenticated users
    },

    // 404 Not Found
    {
      path: '*',
      element: <NotFoundPage />
    }
  ]
}
```

---

## Navigation Components

### SidebarNavigation Component

**File**: `src/components/layout/SidebarNavigation.tsx:20`

```typescript
interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  roles?: UserRole[]
  department?: Department
  requiresMatrixAccess?: boolean
  requiresVideoAccess?: boolean
  badge?: string | number
  subItems?: NavItem[]
}

const navigationItems: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'management', 'house_tech', 'technician']
  },
  {
    label: 'Disponibilidad',
    path: '/availability',
    icon: Calendar,
    roles: ['admin', 'management']
  },
  {
    label: 'Agenda',
    path: '/agenda',
    icon: CalendarDays,
    roles: ['admin', 'management', 'house_tech']
  },
  {
    label: 'Proyectos',
    path: '/projects',
    icon: FolderKanban,
    roles: ['admin', 'management']
  },
  {
    label: 'Incidencias',
    path: '/incidencias',
    icon: AlertCircle,
    roles: ['admin', 'management', 'house_tech', 'technician'],
    badge: 'pendingIncidents' // Dynamic badge count
  },
  {
    label: 'Tarifas',
    path: '/rates',
    icon: DollarSign,
    roles: ['admin', 'management']
  },
  {
    label: 'Giras',
    path: '/tours',
    icon: Truck,
    roles: ['admin', 'management', 'house_tech', 'technician']
  },
  {
    label: 'Logistics',
    path: '/logistics',
    icon: Package,
    roles: ['admin', 'management', 'logistics', 'house_tech'],
    subItems: [
      {
        label: 'Inventario',
        path: '/logistics/inventory',
        icon: ListChecks,
        roles: ['admin', 'management', 'logistics']
      },
      {
        label: 'Almacén',
        path: '/logistics/warehouse',
        icon: Warehouse,
        roles: ['admin', 'management', 'logistics']
      },
      {
        label: 'Vehículos',
        path: '/logistics/vehicles',
        icon: Car,
        roles: ['admin', 'management', 'logistics']
      }
    ]
  },
  {
    label: 'Festivales',
    path: '/festivals',
    icon: Music,
    roles: ['admin', 'management'],
    department: 'Sound' // Sound department users also get access
  },
  {
    label: 'Job Matrix',
    path: '/matrix',
    icon: Grid,
    requiresMatrixAccess: true
  },
  {
    label: 'Administración',
    path: '/admin',
    icon: Settings,
    roles: ['admin'],
    subItems: [
      {
        label: 'Wallboard',
        path: '/admin/wallboard',
        icon: Monitor,
        roles: ['admin']
      },
      {
        label: 'Actividad',
        path: '/admin/activity',
        icon: Activity,
        roles: ['admin']
      },
      {
        label: 'Anuncios',
        path: '/admin/announcements',
        icon: Megaphone,
        roles: ['admin']
      },
      {
        label: 'Usuarios',
        path: '/admin/users',
        icon: Users,
        roles: ['admin']
      }
    ]
  },
  {
    label: 'Video',
    path: '/video',
    icon: Video,
    requiresVideoAccess: true
  },
  {
    label: 'Perfil',
    path: '/profile',
    icon: User
    // No roles restriction - all authenticated users
  }
]
```

### Navigation Filtering Logic

```typescript
const SidebarNavigation: React.FC = () => {
  const { user } = useAuth()
  const location = useLocation()

  const filteredNavItems = useMemo(() => {
    return navigationItems.filter(item => hasAccess(item, user))
  }, [user])

  const hasAccess = (item: NavItem, user: User): boolean => {
    // Admin sees everything
    if (user.role === 'admin') return true

    // Check role-based access
    if (item.roles && !item.roles.includes(user.role)) {
      // Check department override for festivals
      if (item.department && user.department === item.department) {
        return true
      }
      return false
    }

    // Check matrix access
    if (item.requiresMatrixAccess && user.matrixAccess === 'none') {
      return false
    }

    // Check video access
    if (item.requiresVideoAccess && !user.video_user) {
      return false
    }

    // Filter sub-items
    if (item.subItems) {
      item.subItems = item.subItems.filter(subItem => hasAccess(subItem, user))
      if (item.subItems.length === 0) return false
    }

    return true
  }

  return (
    <nav className="sidebar">
      {filteredNavItems.map(item => (
        <NavItemComponent key={item.path} item={item} />
      ))}
    </nav>
  )
}
```

### Header Navigation

**File**: `src/components/layout/Header.tsx:15`

```typescript
Header
 ├─ Logo (links to dashboard)
 ├─ BreadcrumbNav
 │   └─ Breadcrumb items based on current route
 ├─ GlobalSearch (admin, management only)
 ├─ NotificationBell
 │   └─ NotificationDropdown
 │       └─ NotificationItem[]
 └─ UserMenu
     ├─ UserAvatar
     └─ DropdownMenu
         ├─ MenuItem: Profile
         ├─ MenuItem: Settings
         ├─ Divider
         └─ MenuItem: Logout
```

---

## Route Protection

### ProtectedRoute Component

**File**: `src/components/ProtectedRoute.tsx`

```typescript
interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
  requireMatrixAccess?: boolean
  requireVideoAccess?: boolean
  departmentOverride?: Department
  children?: React.ReactNode
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  allowedRoles,
  requireMatrixAccess,
  requireVideoAccess,
  departmentOverride,
  children
}) => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return

    // Not authenticated
    if (!user) {
      navigate('/login')
      return
    }

    // Check role-based access
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      // Check department override
      if (departmentOverride && user.department === departmentOverride) {
        return // Allow access
      }

      // Unauthorized
      toast.error('No tienes permisos para acceder a esta página')
      navigate('/')
      return
    }

    // Check matrix access
    if (requireMatrixAccess && user.matrixAccess === 'none') {
      toast.error('No tienes acceso a la matriz de trabajos')
      navigate('/')
      return
    }

    // Check video access
    if (requireVideoAccess && !user.video_user) {
      toast.error('No tienes acceso al departamento de video')
      navigate('/')
      return
    }
  }, [user, loading, navigate, allowedRoles, requireMatrixAccess, requireVideoAccess, departmentOverride])

  if (loading) {
    return <LoadingSpinner />
  }

  return <Outlet />
}
```

### RequireAuth Component

**File**: `src/components/RequireAuth.tsx`

```typescript
const RequireAuth: React.FC = () => {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!loading && !user) {
      // Redirect to login, save the attempted location
      navigate('/login', {
        state: { from: location.pathname }
      })
    }
  }, [user, loading, navigate, location])

  if (loading) {
    return <LoadingSpinner />
  }

  if (!user) {
    return null
  }

  return <Outlet />
}
```

### Protection Layers Summary

```
Route Protection Layers (in order):

1. Public Check
   └─ Is route public? (login, wallboard)
      ├─ Yes → Render directly
      └─ No → Continue to layer 2

2. Authentication Check (RequireAuth)
   └─ Is user authenticated?
      ├─ Yes → Continue to layer 3
      └─ No → Redirect to /login

3. Role Check (ProtectedRoute)
   └─ Does user have required role?
      ├─ Yes → Continue to layer 4
      └─ No → Check department override
          ├─ Has override → Continue
          └─ No override → Redirect to dashboard

4. Permission Check (ProtectedRoute)
   └─ Does user have special permissions?
      ├─ matrixAccess required?
      │   └─ Has matrixAccess → Continue
      │       └─ Else → Redirect
      ├─ video_user required?
      │   └─ Is video_user → Continue
      │       └─ Else → Redirect
      └─ All checks passed → Render component

5. Page-level Guards (useRoleGuard hook)
   └─ Additional checks within components
      └─ Hide/disable features based on permissions
```

---

## Dynamic Routing

### Route Parameters

```typescript
// Tours
/tours                      → ToursPage (list)
/tours/:tourId             → TourDetailsPage
/tours/:tourId/events/:eventId → TourEventDetailsPage

// Projects
/projects                  → ProjectsPage (list)
/projects/:projectId       → ProjectDetailsPage

// Incidencias
/incidencias              → IncidenciasPage (list)
/incidencias/:incidentId  → IncidentDetailsPage

// Logistics
/logistics                        → LogisticsPage (overview)
/logistics/inventory              → InventoryPage
/logistics/inventory/:itemId      → InventoryItemDetailsPage
/logistics/warehouse              → WarehousePage
/logistics/vehicles               → VehiclesPage

// Festivals
/festivals                 → FestivalsPage (list)
/festivals/:festivalId     → FestivalDetailsPage

// Admin
/admin/users               → UsersPage (list)
/admin/users/:userId       → UserDetailsPage
```

### Using Route Parameters

```typescript
// In TourDetailsPage.tsx
import { useParams } from 'react-router-dom'

const TourDetailsPage: React.FC = () => {
  const { tourId } = useParams<{ tourId: string }>()

  const { data: tour, loading } = useTour(tourId)

  return (
    // Component JSX
  )
}
```

### Programmatic Navigation

```typescript
import { useNavigate } from 'react-router-dom'

const MyComponent: React.FC = () => {
  const navigate = useNavigate()

  const handleViewTour = (tourId: string) => {
    navigate(`/tours/${tourId}`)
  }

  const handleGoBack = () => {
    navigate(-1) // Go back one page
  }

  const handleGoToDashboard = () => {
    navigate('/', { replace: true }) // Replace current history entry
  }

  return (
    // Component JSX
  )
}
```

---

## Breadcrumb Navigation

**File**: `src/components/layout/Header.tsx` (BreadcrumbNav component)

### Breadcrumb Generation

```typescript
const useBreadcrumbs = () => {
  const location = useLocation()
  const params = useParams()

  const generateBreadcrumbs = (): Breadcrumb[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    const breadcrumbs: Breadcrumb[] = [
      { label: 'Inicio', path: '/' }
    ]

    let currentPath = ''

    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`

      // Check if segment is a dynamic parameter
      if (segment.match(/^[0-9a-f-]{36}$/)) {
        // It's a UUID, fetch the name
        const label = getEntityName(segment, pathSegments[index - 1])
        breadcrumbs.push({ label, path: currentPath })
      } else {
        // Static segment
        const label = segmentToLabel(segment)
        breadcrumbs.push({ label, path: currentPath })
      }
    })

    return breadcrumbs
  }

  return generateBreadcrumbs()
}

const segmentToLabel = (segment: string): string => {
  const labels: Record<string, string> = {
    'tours': 'Giras',
    'projects': 'Proyectos',
    'incidencias': 'Incidencias',
    'logistics': 'Logística',
    'inventory': 'Inventario',
    'warehouse': 'Almacén',
    'vehicles': 'Vehículos',
    'festivals': 'Festivales',
    'matrix': 'Matriz de Trabajos',
    'admin': 'Administración',
    'users': 'Usuarios',
    'activity': 'Actividad',
    'announcements': 'Anuncios',
    'video': 'Video',
    'profile': 'Perfil',
    'availability': 'Disponibilidad',
    'agenda': 'Agenda',
    'rates': 'Tarifas'
  }

  return labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1)
}
```

### Breadcrumb Examples

```
/
→ Inicio

/tours
→ Inicio > Giras

/tours/abc-123
→ Inicio > Giras > Tour de Verano 2025

/tours/abc-123/events/xyz-789
→ Inicio > Giras > Tour de Verano 2025 > Evento en Madrid

/logistics/inventory/item-456
→ Inicio > Logística > Inventario > Consola DiGiCo SD12

/admin/users/user-789
→ Inicio > Administración > Usuarios > Juan Pérez
```

---

## Navigation State Management

### Active Route Highlighting

```typescript
const NavItemComponent: React.FC<{ item: NavItem }> = ({ item }) => {
  const location = useLocation()

  const isActive = useMemo(() => {
    if (item.path === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(item.path)
  }, [location.pathname, item.path])

  return (
    <Link
      to={item.path}
      className={cn(
        'nav-item',
        isActive && 'nav-item-active'
      )}
    >
      <item.icon className="nav-icon" />
      <span>{item.label}</span>
      {item.badge && <Badge>{item.badge}</Badge>}
    </Link>
  )
}
```

### Scroll to Top on Route Change

```typescript
// In App.tsx or Layout.tsx
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
```

---

## Route Guards Examples

### Example 1: House Tech Department Filtering

```typescript
// In ToursPage.tsx
const ToursPage: React.FC = () => {
  const { user } = useAuth()
  const { data: tours } = useTours()

  // Filter tours by department for house_tech
  const filteredTours = useMemo(() => {
    if (user.role === 'house_tech' && user.department) {
      return tours.filter(tour =>
        tour.departments.includes(user.department)
      )
    }
    return tours
  }, [tours, user])

  return (
    // Component JSX
  )
}
```

### Example 2: Logistics View-Only for House Tech

```typescript
// In LogisticsPage.tsx
const LogisticsPage: React.FC = () => {
  const { user } = useAuth()

  const isViewOnly = user.role === 'house_tech'

  return (
    <div>
      <PageHeader
        title="Logística"
        actions={!isViewOnly && (
          <Button onClick={handleAddEquipment}>
            Nuevo Equipo
          </Button>
        )}
      />

      <EquipmentTable
        editable={!isViewOnly}
      />
    </div>
  )
}
```

### Example 3: Matrix Access Check

```typescript
// In JobMatrixPage.tsx
const JobMatrixPage: React.FC = () => {
  const { user } = useAuth()

  const canEdit = user.matrixAccess === 'edit'
  const canView = user.matrixAccess !== 'none'

  if (!canView) {
    return <Navigate to="/" replace />
  }

  return (
    <MatrixGrid
      editable={canEdit}
    />
  )
}
```

---

## Key Files Reference

- **Main Router**: `src/main.tsx:1`
- **Route Definitions**: `src/App.tsx:15`
- **Protected Route**: `src/components/ProtectedRoute.tsx:1`
- **Require Auth**: `src/components/RequireAuth.tsx:1`
- **Layout**: `src/components/layout/Layout.tsx:19`
- **Sidebar Navigation**: `src/components/layout/SidebarNavigation.tsx:20`
- **Header**: `src/components/layout/Header.tsx:15`
- **Role-based Routing Utils**: `src/utils/roleBasedRouting.ts:1`
- **Permissions Utils**: `src/utils/permissions.ts:1`
