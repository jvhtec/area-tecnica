# Global Application Tree Structure

## High-Level Application Tree

```
App (src/main.tsx + src/App.tsx)
 ├─ Providers
 │   ├─ React.StrictMode
 │   ├─ BrowserRouter
 │   ├─ AuthProvider (src/hooks/useOptimizedAuth.tsx)
 │   ├─ UserRoleProvider (src/contexts/UserRoleContext.tsx)
 │   ├─ SyncProvider (src/contexts/SyncContext.tsx)
 │   ├─ CacheProvider (src/contexts/CacheContext.tsx)
 │   └─ Toaster (shadcn/ui)
 │
 └─ Router (src/App.tsx)
     ├─ PublicRoute: /login → LoginPage
     ├─ PublicRoute: /wallboard → WallboardPage
     │
     └─ RequireAuth (Session Check)
         └─ Layout (src/components/layout/Layout.tsx)
             ├─ Header (src/components/layout/Header.tsx)
             │   ├─ Logo
             │   ├─ BreadcrumbNav
             │   ├─ NotificationBell
             │   ├─ GlobalSearch
             │   └─ UserMenu (all roles)
             │       ├─ Profile
             │       ├─ Settings
             │       └─ Logout
             │
             ├─ SidebarNavigation (src/components/layout/SidebarNavigation.tsx)
             │   ├─ NavItem: Dashboard        (admin, management, house_tech, technician)
             │   ├─ NavItem: Disponibilidad   (admin, management)
             │   ├─ NavItem: Agenda           (admin, management, house_tech)
             │   ├─ NavItem: Proyectos        (admin, management)
             │   ├─ NavItem: Incidencias      (admin, management, house_tech, technician)
             │   ├─ NavItem: Tarifas          (admin, management)
             │   ├─ NavItem: Giras            (admin, management, house_tech, technician)
             │   ├─ NavItem: Logistics        (admin, management, logistics, house_tech[view-only])
             │   ├─ NavItem: Festivales       (admin, management, house_tech[Sound dept], technician[Sound dept])
             │   ├─ NavItem: Job Matrix       (admin, users with matrixAccess != 'none')
             │   ├─ NavItem: Wallboard        (admin)
             │   ├─ NavItem: Activity         (admin)
             │   ├─ NavItem: Anuncios         (admin)
             │   ├─ NavItem: Video            (admin, users with video_user flag)
             │   ├─ NavItem: Perfil           (all roles)
             │   └─ NavItem: Logout           (all roles)
             │
             ├─ MobileNavigation (responsive variant of SidebarNavigation)
             │
             └─ ContentRouter (Outlet)
                 └─ ProtectedRoute (Role Check)
                     └─ PageComponent (see detailed trees below)
```

## Role Definitions

```typescript
// Source: src/types/user.ts
type UserRole =
  | 'admin'        // Full system access
  | 'management'   // Business operations & reporting
  | 'logistics'    // Equipment & resource management
  | 'technician'   // Field technician
  | 'house_tech'   // Venue tech (department-specific)
  | 'wallboard'    // Read-only display mode

// Additional permission flags:
interface User {
  role: UserRole
  department?: 'Sound' | 'Light' | 'Video' | 'Logistics'
  matrixAccess?: 'edit' | 'view' | 'none'
  video_user?: boolean
  // ... other fields
}
```

## Main Layout Structure

### Layout Component (src/components/layout/Layout.tsx:19)

```
Layout
 ├─ <div className="flex h-screen">
 │   ├─ SidebarNavigation (hidden on mobile)
 │   │
 │   └─ <div className="flex-1 flex flex-col">
 │       ├─ Header
 │       │
 │       └─ <main className="flex-1 overflow-auto">
 │           └─ <Outlet /> (Router content)
 │
 └─ MobileNavigation (visible on mobile only)
```

## Navigation Structure Details

### SidebarNavigation Component (src/components/layout/SidebarNavigation.tsx:20)

The navigation items are filtered based on user role and permissions using the following logic:

```typescript
// Simplified from src/components/layout/SidebarNavigation.tsx:50
const filteredNavItems = navItems.filter(item => {
  // Admin sees everything
  if (user?.role === 'admin') return true

  // Check role-based access
  if (item.roles && !item.roles.includes(user?.role)) return false

  // Check department-specific access
  if (item.department && user?.department !== item.department) return false

  // Check special permissions
  if (item.requiresMatrixAccess && user?.matrixAccess === 'none') return false
  if (item.requiresVideoAccess && !user?.video_user) return false

  return true
})
```

### Navigation Items Configuration

```typescript
// Derived from src/components/layout/SidebarNavigation.tsx
const navigationItems = [
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
    roles: ['admin', 'management', 'house_tech', 'technician']
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
    viewOnly: ['house_tech'] // Read-only for house_tech
  },
  {
    label: 'Festivales',
    path: '/festivals',
    icon: Music,
    roles: ['admin', 'management'],
    departmentRoles: {
      'Sound': ['house_tech', 'technician'] // Sound dept users get access
    }
  },
  {
    label: 'Job Matrix',
    path: '/matrix',
    icon: Grid,
    requiresMatrixAccess: true, // matrixAccess != 'none'
    roles: ['admin'] // + any user with matrixAccess
  },
  {
    label: 'Wallboard',
    path: '/wallboard',
    icon: Monitor,
    roles: ['admin']
  },
  {
    label: 'Activity',
    path: '/activity',
    icon: Activity,
    roles: ['admin']
  },
  {
    label: 'Anuncios',
    path: '/announcements',
    icon: Megaphone,
    roles: ['admin']
  },
  {
    label: 'Video',
    path: '/video',
    icon: Video,
    requiresVideoAccess: true,
    roles: ['admin'] // + any user with video_user flag
  },
  {
    label: 'Perfil',
    path: '/profile',
    icon: User,
    roles: 'all' // All authenticated users
  }
]
```

## Content Router Structure

The content area (`<Outlet />`) renders different page components based on the route:

```
ContentRouter
 ├─ / → Dashboard (role-based)
 │   ├─ AdminDashboard (admin)
 │   ├─ ManagementDashboard (management)
 │   ├─ HouseTechDashboard (house_tech)
 │   └─ TechnicianDashboard (technician)
 │
 ├─ /availability → AvailabilityPage
 ├─ /agenda → AgendaPage
 ├─ /projects → ProjectsPage
 ├─ /incidencias → IncidenciasPage
 ├─ /rates → RatesPage
 ├─ /tours → ToursPage (with sub-routes)
 ├─ /logistics → LogisticsPage
 ├─ /festivals → FestivalsPage
 ├─ /matrix → JobMatrixPage
 ├─ /wallboard → WallboardPage
 ├─ /activity → ActivityPage
 ├─ /announcements → AnnouncementsPage
 ├─ /video → VideoPage
 └─ /profile → ProfilePage
```

## Route Protection Layers

The application uses multiple layers of protection:

```
1. Public Routes (no auth required)
   └─ /login, /wallboard

2. RequireAuth (session check)
   └─ Checks if user is authenticated via Supabase
      └─ Redirects to /login if not authenticated

3. ProtectedRoute (role check)
   └─ Checks if user role is allowed for route
      └─ Redirects to dashboard if not authorized

4. Page-level guards (useRoleGuard hook)
   └─ Additional checks within components
      └─ Department, matrixAccess, video_user, etc.
```

## Key Files Reference

- **Entry Point**: `src/main.tsx:1`
- **App Component**: `src/App.tsx:1`
- **Layout**: `src/components/layout/Layout.tsx:19`
- **Header**: `src/components/layout/Header.tsx:15`
- **Sidebar Navigation**: `src/components/layout/SidebarNavigation.tsx:20`
- **Auth Provider**: `src/hooks/useOptimizedAuth.tsx:50`
- **User Role Provider**: `src/contexts/UserRoleContext.tsx:1`
- **Protected Route**: `src/components/ProtectedRoute.tsx:1`
- **Role Utils**: `src/utils/roleBasedRouting.ts:1`
- **Permissions**: `src/utils/permissions.ts:1`

---

See `page-component-trees.md` for detailed component hierarchies of each page.
