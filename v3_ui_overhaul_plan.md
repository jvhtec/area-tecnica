# V3 UI Overhaul: "Area Tecnica Premium"

## Vision
To transform the functional utility of "Area Tecnica" into a premium, world-class application that feels like a "Command Center" for AV professionals. The design language focuses on **Glassmorphism**, **Neon Accents**, and **Deep Dark Modes**.

## Design System Core
*   **Typography:** `Inter` (UI) + `JetBrains Mono` (Data/Code).
*   **Colors:**
    *   Background: Deep Slate/Navy (`#0f172a` to `#020617`).
    *   Primary: Electric Purple (`#7c3aed`) & Cyan (`#06b6d4`).
    *   Status: Neon Green (Success), Amber (Warning), Rose (Error).
*   **Effects:**
    *   **Glass:** `backdrop-filter: blur(12px)`, `bg-white/5`.
    *   **Glow:** Box shadows with colored spreads for active states.
    *   **Motion:** Smooth layout transitions (`framer-motion`).

---

## Surface 1: Core Dashboards

### 1.1 Technician Dashboard ("The Cockpit")
*   **Goal:** Instant clarity for the crew member. "Where do I go? What do I do?"
*   **Key Changes:**
    *   **Hero:** Personalized greeting with next job snapshot.
    *   **Cards:** Glass cards with glowing status borders.
    *   **Mobile:** Bottom navigation bar for quick access to "Jobs", "Messages", "Profile".
*   **Mockup:** `technician_dashboard_concept.png`

### 1.2 Admin Dashboard ("Mission Control")
*   **Goal:** Strategic overview for management. High data density, low noise.
*   **Key Changes:**
    *   **KPI Row:** Floating glass widgets for top-level stats.
    *   **Split View:** Calendar + Live Operations Feed.
    *   **Quick Actions:** Floating Action Button (FAB) or persistent dock.
*   **Mockup:** `admin_dashboard_concept.png`

### 1.3 Wallboard ("The Big Screen")
*   **Goal:** Passive information radiator for the warehouse/office.
*   **Key Changes:**
    *   **Typography:** Massive, high-contrast fonts readable from 10m away.
    *   **Dark Mode Only:** To reduce glare on TV screens.
    *   **Auto-Scroll:** Smooth marquee effects for long lists.
*   **Mockup:** `wallboard_concept.png`

---

## Surface 2: Operations & Logistics

### 2.1 Staffing Matrix ("Command Grid")
*   **Goal:** Efficient allocation of human resources.
*   **Key Changes:**
    *   **Sticky Headers:** Locked timeline and user lists.
    *   **Visual Bars:** Continuous Gantt-style bars for assignments.
    *   **Density:** Compact mode toggle for power users.
*   **Mockup:** `staffing_matrix_concept.png`

### 2.2 Project & Festival Management
*   **Goal:** Managing complex, multi-day events.
*   **Key Changes:**
    *   **Kanban View:** Glass columns for job stages.
    *   **Resource Timeline:** Visual timeline of gear/trucks assigned to the festival.

---

## Surface 3: Departmental Hubs (Sound, Lights, Video)

### 3.1 Department Landing
*   **Goal:** A home base for specific disciplines.
*   **Key Changes:**
    *   **Themed Accents:** Sound (Yellow), Lights (Purple), Video (Blue).
    *   **Tool Grid:** Icon-heavy grid for accessing tools (Consumos, Pesos).
*   **Mockup:** `sound_department_hub_concept.png`

### 3.2 Technical Tools (Calculators/Lists)
*   **Goal:** Functional utility without ugliness.
*   **Key Changes:**
    *   **Input Fields:** Floating labels with glowing focus states.
    *   **Results:** Large, animated number counters.

---

## Surface 4: User & HR

### 4.1 Login / Auth
*   **Goal:** The first impression.
*   **Key Changes:**
    *   **Background:** Animated abstract mesh gradient.
    *   **Form:** Centered glass card.
*   **Mockup:** `mobile_login_concept.png`

### 4.2 Profile & Settings
*   **Goal:** Personal space.
*   **Key Changes:**
    *   **Avatar:** Large, editable avatar with "glitch" hover effect.
    *   **Preferences:** Toggle switches with neon active states.

---

## Phase 0: Codebase Hygiene & Standardization (Critical)
Before applying new paint, we must sand the surface. The codebase has significant debt.

### 0.1 Component Deduplication
*   **Problem:** `JobCardNew.tsx` exists in multiple locations (`dashboard/`, `jobs/cards/`).
*   **Action:** Consolidate into `src/components/cards/JobCard.tsx`.
*   **Target:** Identify and merge all duplicate UI logic.

### 0.2 Inline Style Removal
*   **Problem:** Critical components (`AssignmentMatrix`, `TechnicianRow`) use hardcoded `style={{...}}` for layout.
*   **Action:** Refactor to use Tailwind utility classes or CSS variables for dynamic values (e.g., `var(--cell-width)`).

### 0.3 Directory Restructuring
*   **Problem:** Deep nesting (`src/components/festival/form/sections`) makes discovery hard.
*   **Action:** Flatten to Feature-based architecture:
    *   `src/features/festival/components`
    *   `src/features/matrix/components`
    *   `src/components/ui` (Shared primitives only)

---

## Implementation Strategy (V3)
1.  **Phase 0: Hygiene.** Deduplicate components and fix directory structure.
2.  **Phase 1: The Shell.** Update `App.tsx`, `index.css`, and the main `Layout`. Implement the new background and typography.
2.  **Phase 2: Core Dashboards.** Roll out the new Tech and Admin dashboards.
3.  **Phase 3: The Matrix.** Rebuild the staffing matrix with the new grid system.
4.  **Phase 4: Global Polish.** Update all remaining forms, buttons, and dialogs to match the new design system.
