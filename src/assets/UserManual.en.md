# User Manual (Área Técnica)

This is a **user-facing** guide for the app.

- Route: **/manual**
- Use the search box on the left to find things fast.

![Dashboard](/manual/dashboard.png)

## Quick glossary

- **Job**: a specific work item/day (where you check location, docs, staff, etc.).
- **Tour**: groups jobs and shared tour-level documents.
- **Tour dates (tour_dates)**: the tour calendar.
- **Timesheet**: the canonical record of which days a technician actually works.

## Roles and permissions

Access depends on your **role** (and sometimes your department).

- **admin**: full access.
- **management**: planning/assignments + management.
- **logistics**: logistics workflows (documentation, expenses, etc.).
- **house_tech**: internal technician with extended access.
- **technician**: assigned work only (mobile view + job details).

If you can’t see a page, it’s usually **not enabled for your role**.

## Navigation basics

- **Dashboard**: overview + entry point.
- **Tours**: tour management + tour documents.
- **Festivals**: festival management by job.
- **Hoja de Ruta**: day sheet generator + PDF.
- **Timesheets**: worked days / confirmations.
- **Tools**: internal technical utilities.

## Core workflow (everyone)

1. Go to **Dashboard** and find your upcoming work.
2. Open the **Job**.
3. Check:
   - time/location
   - assigned staff
   - documents
   - pending tasks

## Technicians: mobile view and documents

Technicians typically work from the mobile view (**/tech-app**).

Inside a Job → **Docs** tab you can:
- view/download **job documents**
- if the job belongs to a tour: view **Tour documents** (only those marked as visible)

![Technician portal](/manual/freelancer-portal.png)

## Tour documents (visibility)

Tour documents are uploaded at tour level and controlled via a visibility flag:

- Managers can mark a document as **Visible to technicians**.
- Technicians will only see/download documents that are visible.

**Where tour documents appear:**
- **Tours → documents**
- **Job details → Docs → “Tour documents”** (when the job is part of a tour)

![Tour management](/manual/tour-management.png)

## Festivals (basics)

For festival jobs you can:
- manage artists
- manage gear requirements
- print/generate documentation

![Festival management](/manual/festival-management.png)

## Hoja de Ruta (day sheet) + PDF

Hoja de Ruta is the **day sheet generator**. Typical flow:

1. Open the job/festival.
2. Fill in contacts, staff, travel and program.
3. Save.
4. Generate the **PDF**.

If something is missing, double-check **Contacts**, **Staff** and **Location** sections.

![Day sheet](/manual/day-sheet.png)

## Timesheets

Timesheets are the canonical source of **which days a technician works**.

- Future active timesheets affect:
  - what appears in “My Tours”
  - when a tour disappears from a technician’s list after they have no upcoming days

## Pending tasks

Some workflows create pending tasks/approvals.

When you see a badge or a modal:
1. open it
2. read the context
3. complete/approve

## Technical tools

Área Técnica includes internal tools (weights, power, stage plot, etc.). Access depends on role.

![Technical tools](/manual/technical-tools.png)

## Wallboard / digital signage (if you use it)

There are wallboard/signage views designed for screens (restricted by role).

![Digital signage](/manual/digital-signage.png)

## Troubleshooting

- **I can’t see a page** → role/department permissions.
- **A tour document is missing** → it may not be marked *Visible to technicians*.
- **I uploaded a document and it doesn’t show** → refresh; it should update quickly.
- **Data looks stale** → refresh; the app also refreshes automatically.
