# User Manual

This manual provides an overview of the application's features and workflows.

## Table of Contents
1. [Introduction](#introduction)
2. [Pages and Workflows](#pages-and-workflows)
   - [Auth](#auth)
   - [ConsumosTool](#consumostool)
   - [Dashboard](#dashboard)
   - [EquipmentManagement](#equipmentmanagement)
   - [FestivalArtistManagement](#festivalartistmanagement)
   - [FestivalGearManagement](#festivalgearmanagement)
   - [FestivalManagement](#festivalmanagement)
   - [Festivals](#festivals)
   - [HojaDeRuta](#hojaderuta)
   - [JobAssignmentMatrix](#jobassignmentmatrix)
   - [Landing](#landing)
   - [Lights](#lights)
   - [LightsConsumosTool](#lightsconsumostool)
   - [LightsDisponibilidad](#lightsdisponibilidad)
   - [LightsMemoriaTecnica](#lightsmemoratecnica)
   - [LightsPesosTool](#lightspesostool)
   - [Logistics](#logistics)
   - [Personal](#personal)
   - [PesosTool](#pesostool)
   - [Profile](#profile)
   - [ProjectManagement](#projectmanagement)
   - [Settings](#settings)
   - [Sound](#sound)
   - [TechnicianDashboard](#techniciandashboard)
   - [Timesheets](#timesheets)
   - [TourManagement](#tourmanagement)
   - [Tours](#tours)
   - [VacationManagement](#vacationmanagement)
   - [Video](#video)
   - [VideoConsumosTool](#videoconsumostool)
   - [VideoMemoriaTecnica](#videomemoratecnica)
   - [VideoPesosTool](#videopesostool)

## Introduction

This application is designed to streamline various aspects of event management, including logistics, personnel, equipment, and more.

## Pages and Workflows

### Auth
- **Purpose**: Handles user authentication, including login and registration.
- **Workflow**:
    1. User accesses the Auth page.
    2. User enters credentials (email/username and password) or registers for a new account.
    3. Upon successful authentication or registration, the user is redirected to the Dashboard.

### ConsumosTool
- **Purpose**: Allows users to input and manage consumption data.
- **Workflow**:
    1. Navigate to the ConsumosTool page.
    2. Enter consumption details (e.g., item, quantity, cost).
    3. Save the consumption data.

### Dashboard
- **Purpose**: Provides an overview of key information and quick access to various features.
- **Workflow**:
    1. User logs in and is redirected to the Dashboard.
    2. User can view summaries, recent activity, and navigate to other sections of the application.

### EquipmentManagement
- **Purpose**: Manages equipment inventory, including adding, editing, and deleting equipment.
- **Workflow**:
    1. Navigate to the EquipmentManagement page.
    2. View the list of available equipment fetched from the `global_stock_entries` table.
    3. The `StockCreationManager` component is used to display and manage stock entries.
    4. Users can update inventory quantities.
    5. The page includes error handling for loading inventory data.

### FestivalArtistManagement
- **Purpose**: Manages artist information for festivals.
- **Workflow**:
    1. Access the FestivalArtistManagement page.
    2. Add, view, edit, or delete artist details.

### FestivalGearManagement
- **Purpose**: Manages gear requirements for festival artists.
- **Workflow**:
    1. Navigate to the FestivalGearManagement page.
    2. Assign specific gear to artists for a festival.

### FestivalManagement
- **Purpose**: Manages overall festival details and logistics.
- **Workflow**:
    1. Access the FestivalManagement page for a specific job ID.
    2. View festival title, dates, artist count, and maximum stages.
    3. Navigate to sub-sections for Artists, Gear, and Scheduling.
    4. Option to print documentation (combined or individual stage PDFs) with customizable options.
    5. Integrates with a "Flex" system to open external resources.
    6. Functionality may vary based on user role (admin, management, logistics, technician).

### Festivals
- **Purpose**: Lists all upcoming and past festivals with real-time updates.
- **Workflow**:
    1. Access the Festivals page to view a list of festivals.
    2. Festivals are displayed using `JobCard` components, with pagination and highlighting for the closest upcoming festival.
    3. Festival logos are fetched and displayed.
    4. Users can click on a festival to navigate to its management page (`/festival-management/:jobId`).
    5. Users with appropriate roles can print festival documentation (combined or per stage) via a print dialog.
    6. The page includes features for connection status monitoring and automatic reconnection attempts.

### HojaDeRuta
- **Purpose**: Manages the "Hoja de Ruta" (Roadmap) feature, likely for project or event planning.
- **Workflow**:
    1. Access the HojaDeRuta page.
    2. The page displays a "Hoja de Ruta Generator" with a status indicator (e.g., Draft, Review, Approved).
    3. Users can load job data, refresh data, and view data source information (Saved Data, Basic Data, No Data).
    4. Key sections include:
        - Event Details (including job selection)
        - Image Uploads (for venue and venue map)
        - Venue Location
        - Contacts
        - Staff
        - Travel Arrangements
        - Accommodations
        - Program Details
    5. Users can save changes, generate a PDF document, and navigate back to "Project Management".
    6. The component uses hooks for form management, image handling, and event handlers.

### JobAssignmentMatrix
- **Purpose**: Visualizes job assignments in a matrix format.
- **Workflow**:
    1. Navigate to the JobAssignmentMatrix page.
    2. View how jobs are assigned to personnel or resources.

### Landing
- **Purpose**: The initial landing page of the application, likely for unauthenticated users or a general introduction.
- **Workflow**:
    1. User visits the application URL.
    2. User sees introductory content and options to log in or sign up.

### Lights
- **Purpose**: Manages lighting equipment and related data.
- **Workflow**:
    1. Navigate to the Lights page.
    2. View and manage lighting equipment.

### LightsConsumosTool
- **Purpose**: Manages consumption data specifically for lighting equipment.
- **Workflow**:
    1. Go to the LightsConsumosTool page.
    2. Input consumption details for lighting equipment.

### LightsDisponibilidad
- **Purpose**: Manages the availability of lighting equipment.
- **Workflow**:
    1. Access the LightsDisponibilidad page.
    2. Update the availability status of lighting equipment.

### LightsMemoriaTecnica
- **Purpose**: Manages technical memory or specifications for lighting equipment.
- **Workflow**:
    1. Navigate to the LightsMemoriaTecnica page.
    2. Input and manage technical details for lighting equipment.

### LightsPesosTool
- **Purpose**: Manages weight-related data for lighting equipment.
- **Workflow**:
    1. Go to the LightsPesosTool page.
    2. Input and manage weight information for lighting equipment.

### Logistics
- **Purpose**: Manages logistical aspects of events or projects.
- **Workflow**:
    1. Access the Logistics page.
    2. Organize and manage transportation, scheduling, and other logistical details.

### Personal
- **Purpose**: Manages personnel information and assignments.
- **Workflow**:
    1. Access the Personal page.
    2. View, add, edit, or remove personnel records.

### PesosTool
- **Purpose**: Manages weight-related data across different categories.
- **Workflow**:
    1. Go to the PesosTool page.
    2. Input and manage weight information.

### Profile
- **Purpose**: Allows users to view and manage their profile information.
- **Workflow**:
    1. Navigate to the Profile page.
    2. View and edit personal details, settings, etc.

### ProjectManagement
- **Purpose**: Manages project-related tasks and information.
- **Workflow**:
    1. Access the ProjectManagement page.
    2. Create, update, and track project progress.

### Settings
- **Purpose**: Allows users to configure application settings.
- **Workflow**:
    1. Navigate to the Settings page.
    2. Adjust preferences and application configurations.

### Sound
- **Purpose**: Manages sound equipment and related data.
- **Workflow**:
    1. Access the Sound page.
    2. View and manage sound equipment.

### TechnicianDashboard
- **Purpose**: Provides a dashboard specifically for technicians.
- **Workflow**:
    1. Technician logs in and is directed to the TechnicianDashboard.
    2. View assigned tasks, schedules, and relevant information.

### Timesheets
- **Purpose**: Manages employee timesheets.
- **Workflow**:
    1. Access the Timesheets page.
    2. Submit or review timesheet entries.

### TourManagement
- **Purpose**: Manages tour-related logistics and information.
- **Workflow**:
    1. Navigate to the TourManagement page.
    2. Organize and manage tour schedules, venues, and details.

### Tours
- **Purpose**: Lists all tours.
- **Workflow**:
    1. Go to the Tours page to view a list of tours.
    2. Click on a tour to see more details.

### VacationManagement
- **Purpose**: Manages employee vacation requests.
- **Workflow**:
    1. Access the VacationManagement page.
    2. Submit a new vacation request or view existing requests.

### Video
- **Purpose**: Manages video equipment and related data.
- **Workflow**:
    1. Access the Video page.
    2. View and manage video equipment.

### VideoConsumosTool
- **Purpose**: Manages consumption data specifically for video equipment.
- **Workflow**:
    1. Go to the VideoConsumosTool page.
    2. Input consumption details for video equipment.

### VideoMemoriaTecnica
- **Purpose**: Manages technical memory or specifications for video equipment.
- **Workflow**:
    1. Navigate to the VideoMemoriaTecnica page.
    2. Input and manage technical details for video equipment.

### VideoPesosTool
- **Purpose**: Manages weight-related data for video equipment.
- **Workflow**:
    1. Go to the VideoPesosTool page.
    2. Input and manage weight information for video equipment.
