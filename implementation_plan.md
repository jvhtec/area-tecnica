# Dashboard Redesign: "Tech Command Center"

## Goal
Transform the current functional `TechnicianDashboard` into a premium, dynamic "Command Center" that wows users and improves usability.

## Design Concept
*   **Aesthetic:** "Glassmorphism" & Dark Mode Deep.
*   **Vibe:** Professional, high-tech, responsive.
*   **Key Visuals:**
    *   **Hero Section:** "Next Mission" focus (Next Job).
    *   **Glass Cards:** Semi-transparent backgrounds with subtle borders.
    *   **Gradients:** Use brand colors (purple/cyan) for accents, not just flat fills.

## Proposed Changes

### 1. Layout Structure (`src/pages/TechnicianDashboard.tsx`)
*   **Header:** Replace standard header with a **Welcome Hero**.
    *   "Good afternoon, [Name]."
    *   Quick Stats: "2 Jobs this week", "1 Pending Timesheet".
*   **Grid System:** Move from a vertical stack to a responsive grid.
    *   **Top:** Hero / Next Job (Full width).
    *   **Middle:** Upcoming Assignments (Horizontal scroll or Grid).
    *   **Bottom:** Widgets (Availability, Tour Rates, Messages).

### 2. Component Upgrades
*   **`JobCardNew.tsx`**:
    *   Add `variant="glass"` prop.
    *   Implement hover lift (transform: translateY) and shadow glow.
    *   Refine status badges (glow effect).
*   **New Components**:
    *   `DashboardHero.tsx`: Handles the welcome and quick stats.
    *   `StatWidget.tsx`: Small cards for quick metrics.

### 3. Visual Polish (CSS/Tailwind)
*   **Background:** Add a subtle mesh gradient or deep color background to the page container to make the glass cards pop.
*   **Typography:** Enforce hierarchy (Big headings, readable metadata).
*   **Animations:**
    *   `framer-motion` (if allowed) or Tailwind `animate-in` for page load.
    *   Smooth transitions for all interactive elements.

## Verification
*   **Visual Check:** Verify the "Wow" factor.
*   **Responsiveness:** Ensure it looks great on mobile (critical for technicians).

# Admin Dashboard Redesign: "Mission Control"

## Goal
Elevate the `Dashboard.tsx` (Admin/Management view) from a simple calendar/list to a strategic "Mission Control" center.

## Design Concept
*   **Aesthetic:** Consistent with the "Tech Command Center" but denser with data.
*   **Vibe:** Strategic, authoritative, real-time.
*   **Key Visuals:**
    *   **KPI Cards:** Top-level metrics (Active Jobs, Pending Approvals).
    *   **Split View:** Calendar + Live Operations Feed.
    *   **Quick Actions:** Floating or prominent action bar.

## Proposed Changes

### 1. Layout Structure (`src/pages/Dashboard.tsx`)
*   **Header:** "Mission Control" branding.
*   **Top Row:** **Status Widgets** (New Component).
    *   Active Jobs (Count).
    *   Issues/Alerts (Red/Yellow indicators).
    *   Unassigned Shifts (Count).
*   **Main Area:**
    *   **Left (2/3):** Enhanced Calendar (Existing `CalendarSection` but styled).
    *   **Right (1/3):** "Live Ops" Feed (New Component) - showing recent check-ins, messages, or system alerts.

### 2. Component Upgrades
*   **`DashboardHeader.tsx`**: Add "Quick Actions" (New Job, Broadcast).
*   **`CalendarSection.tsx`**: Apply glassmorphism to the container.
*   **`StatusWidget.tsx`**: Reusable metric card with trend indicators.

### 3. Visual Polish
*   **Dark Mode:** Deep blue/black theme.
*   **Data Viz:** Use small sparklines or progress bars in widgets.

# Staffing Matrix Redesign: "Staffing Command Grid"

## Goal
Transform the `JobAssignmentMatrix` into a high-performance, visually clear "Command Grid" for complex staffing operations.

## Design Concept
*   **Aesthetic:** Dense, high-contrast, "Spreadsheet on Steroids".
*   **Vibe:** Precision, clarity, efficiency.
*   **Key Visuals:**
    *   **Sticky Headers:** Rock-solid scrolling for both dates (top) and technicians (left).
    *   **Assignment Bars:** Continuous colored bars for multi-day jobs (instead of individual cell blocks).
    *   **Status Indicators:** Neon dots for availability (Green=Free, Red=Busy, Yellow=Pending).

## Proposed Changes

### 1. Layout Structure (`src/pages/JobAssignmentMatrix.tsx`)
*   **Header:** Compact controls to maximize grid space.
*   **Grid Container:** Ensure `OptimizedAssignmentMatrix` takes up full remaining viewport height.

### 2. Component Upgrades (`src/components/matrix/`)
*   **`TechnicianRow.tsx`**:
    *   Add "Skill Badges" (e.g., A1, L2) next to names.
    *   Add "Utilization Bar" (mini progress bar showing % booked this month).
*   **`MatrixCell.tsx`**:
    *   Refine the "Assignment Block" look. Use rounded corners and subtle gradients.
    *   Improve hover states to show job details instantly.
*   **`DateHeader.tsx`**:
    *   Highlight weekends and holidays more clearly.
    *   Show "Event Density" (heatmap style) on the date header.

### 3. Visual Polish
*   **Borders:** Subtle dark borders to reduce visual noise.
*   **Drag & Drop:** Add visual cues (ghosting) when dragging assignments (if DnD is implemented).


