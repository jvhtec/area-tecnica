# Area Técnica Documentation

Welcome to the **Area Técnica** application documentation. This directory contains comprehensive documentation about the application's architecture, component structure, and implementation details.

## 📚 Documentation Index

### Architecture Documentation

Located in `docs/architecture/`:

1. **[Global App Tree](architecture/global-app-tree.md)**
   - High-level application structure
   - Provider hierarchy
   - Layout and navigation components
   - Role definitions and navigation structure
   - Content router overview

2. **[Page Component Trees](architecture/page-component-trees.md)**
   - Detailed component hierarchies for all pages
   - Dashboard variants (Admin, Management, House Tech, Technician)
   - Feature pages (Availability, Agenda, Projects, etc.)
   - Component relationships and data flow
   - Common reusable components

3. **[Navigation and Routing](architecture/navigation-and-routing.md)**
   - Complete route definitions
   - Navigation component structure
   - Route protection layers
   - Dynamic routing patterns
   - Breadcrumb generation

4. **[Role-Based Access Control](architecture/role-based-access.md)**
   - User roles overview
   - Permission system
   - Role capabilities matrix
   - Department-based access
   - Special permissions (matrix access, video user)
   - Implementation details and security

## 🏗️ Application Overview

### Tech Stack

- **Frontend**: React 18 + TypeScript
- **Routing**: React Router v6
- **State Management**: React Context + Custom Hooks
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Backend**: Supabase (PostgreSQL + Real-time subscriptions)
- **Authentication**: Supabase Auth
- **Build Tool**: Vite

### Key Features

- **Role-Based Access Control**: 6 user roles with granular permissions
- **Real-time Updates**: Live data synchronization via Supabase subscriptions
- **Multi-Department Support**: Sound, Light, Video, and Logistics departments
- **Responsive Design**: Mobile-first approach with desktop optimizations
- **Offline Support**: Service worker for offline capabilities
- **Multi-tab Sync**: Cross-tab state synchronization

## 🎯 Quick Reference

### User Roles

1. **Admin** - Full system access and user management
2. **Management** - Business operations and reporting
3. **Logistics** - Equipment and resource management
4. **House Tech** - Department-specific venue operations
5. **Technician** - Field technician with personal dashboard
6. **Wallboard** - Read-only display mode for screens

### Main Routes

```
/                    → Dashboard (role-based)
/availability        → Team availability calendar
/agenda              → Event scheduling
/projects            → Project management
/incidencias         → Incident tracking
/rates               → Pricing and rates
/tours               → Tour management
/logistics           → Equipment and inventory
/festivals           → Festival management
/matrix              → Job assignment matrix
/video               → Video department
/profile             → User profile
/admin/*             → Admin tools
```

### Navigation Structure

```
App
 └─ Layout
     ├─ Header
     │   ├─ Breadcrumb Navigation
     │   ├─ Global Search
     │   ├─ Notifications
     │   └─ User Menu
     │
     ├─ Sidebar Navigation (role-filtered)
     │
     └─ Content Area (route-based)
```

## 📖 How to Use This Documentation

### For New Developers

1. Start with **[Global App Tree](architecture/global-app-tree.md)** to understand the overall structure
2. Review **[Role-Based Access Control](architecture/role-based-access.md)** to understand permissions
3. Refer to **[Page Component Trees](architecture/page-component-trees.md)** when working on specific features
4. Check **[Navigation and Routing](architecture/navigation-and-routing.md)** when adding new routes

### For Feature Development

1. Identify the user role(s) that need access
2. Check the role capabilities matrix in [Role-Based Access Control](architecture/role-based-access.md)
3. Find the relevant page component tree in [Page Component Trees](architecture/page-component-trees.md)
4. Add route protection using patterns from [Navigation and Routing](architecture/navigation-and-routing.md)

### For Code Reviews

1. Verify role-based access is correctly implemented
2. Check that department filtering is applied where needed
3. Ensure route protection matches the requirements
4. Validate component hierarchy follows existing patterns

## 🔑 Key Concepts

### Role-Based Access

Access control happens at multiple layers:
1. **Route Level** - Protected routes check user role
2. **Navigation Level** - Menu items filtered by role
3. **Component Level** - UI elements conditionally rendered
4. **Data Level** - Database RLS policies enforce access

### Department Filtering

Users with `house_tech` or `technician` roles see data filtered by their department:
- Tours include only events for their department
- Equipment shows only department-specific items
- Incidents filtered to department
- Some features (like Festivals) have department overrides

### Permission Flags

Special permissions beyond role:
- `matrixAccess` - Job matrix editing rights (`edit`, `view`, `none`)
- `video_user` - Access to video department features

## 📁 Directory Structure

```
docs/
├── README.md                              # This file
└── architecture/
    ├── global-app-tree.md                 # Application structure
    ├── page-component-trees.md            # Page components
    ├── navigation-and-routing.md          # Routes and navigation
    └── role-based-access.md               # RBAC documentation
```

## 🔗 Related Files

### Core Application Files

```
src/
├── main.tsx                               # App entry point
├── App.tsx                                # Route definitions
├── components/
│   ├── layout/
│   │   ├── Layout.tsx                     # Main layout
│   │   ├── Header.tsx                     # Header component
│   │   ├── SidebarNavigation.tsx         # Navigation menu
│   │   └── MobileNavigation.tsx          # Mobile nav
│   ├── ProtectedRoute.tsx                 # Route protection
│   └── RequireAuth.tsx                    # Auth check
├── hooks/
│   ├── useOptimizedAuth.tsx              # Auth provider
│   └── useRoleGuard.tsx                   # Role guard hook
├── utils/
│   ├── permissions.ts                     # Permission functions
│   └── roleBasedRouting.ts               # Role routing logic
└── types/
    ├── user.ts                            # User types
    └── roles.ts                           # Role types
```

### Page Components

```
src/pages/
├── Dashboard/                             # Role-based dashboards
├── Availability/                          # Availability management
├── Agenda/                                # Event scheduling
├── Projects/                              # Project management
├── Incidencias/                          # Incident tracking
├── Rates/                                 # Pricing
├── Tours/                                 # Tour management
├── Logistics/                             # Equipment/inventory
├── Festivals/                             # Festival management
├── Matrix/                                # Job matrix
├── Wallboard/                             # Display mode
├── Activity/                              # Activity logs
├── Announcements/                         # Announcements
├── Video/                                 # Video department
└── Profile/                               # User profile
```

## 🚀 Getting Started

### Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Environment Variables

Required environment variables:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📝 Contributing

When adding new features:

1. **Update Documentation**: Add component trees and routing info
2. **Follow RBAC Patterns**: Use existing permission checking patterns
3. **Test All Roles**: Verify access for each user role
4. **Update This Index**: Add new documentation files to the index

## 🔍 Troubleshooting

### Common Issues

**Issue**: User can't access a route
- Check role in `ProtectedRoute` definition
- Verify `SidebarNavigation` item configuration
- Check permission flags (matrixAccess, video_user)
- Verify department if applicable

**Issue**: Data not showing for user
- Check department filtering logic
- Verify database RLS policies
- Check data fetching hooks for role-based filtering

**Issue**: Navigation item not appearing
- Check `roles` array in navigation item
- Verify special permission flags
- Check department override logic

## 📞 Support

For questions or issues:
- Review this documentation first
- Check the component tree for the relevant page
- Review role-based access requirements
- Consult the team lead or senior developer

## 📅 Documentation Updates

This documentation was generated on: **2025-11-14**

Last updated: **2025-11-14**

---

**Navigation**: [Global App Tree](architecture/global-app-tree.md) | [Page Components](architecture/page-component-trees.md) | [Routing](architecture/navigation-and-routing.md) | [RBAC](architecture/role-based-access.md)
