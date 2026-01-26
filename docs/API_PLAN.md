# Sector Pro API Mode - Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to implement an API mode for Sector Pro, enabling external agents and integrations to interact with the platform programmatically. The API will expose core platform functionality through RESTful endpoints built on Supabase Edge Functions.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [API Versioning & Standards](#3-api-versioning--standards)
4. [Endpoint Categories](#4-endpoint-categories)
5. [Detailed Endpoint Specifications](#5-detailed-endpoint-specifications)
6. [Rate Limiting & Quotas](#6-rate-limiting--quotas)
7. [Error Handling](#7-error-handling)
8. [Webhooks & Events](#8-webhooks--events)
9. [Implementation Phases](#9-implementation-phases)
10. [Security Considerations](#10-security-considerations)
11. [Testing Strategy](#11-testing-strategy)
12. [Documentation](#12-documentation)

---

## 1. Architecture Overview

### 1.1 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Runtime | Deno (Supabase Edge Functions) | Serverless function execution |
| Database | PostgreSQL (Supabase) | Data persistence with RLS |
| Auth | Supabase Auth + API Keys | Authentication layer |
| Caching | Edge caching + Redis (optional) | Response caching |
| Documentation | OpenAPI 3.0 | API specification |

### 1.2 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        External Clients                          │
│  (Agents, Mobile Apps, Third-party Integrations, Webhooks)      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Rate Limit  │  │ Auth/Keys   │  │ Validation  │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Edge Functions (Deno)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Jobs    │ │  Tours   │ │  Crew    │ │ Timesheets│           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Equipment │ │ Staffing │ │ Messages │ │ Reports  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supabase PostgreSQL                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                  Row Level Security (RLS)                │    │
│  │  - Role-based access (admin, management, technician)    │    │
│  │  - Department scoping (sound, lights, video, etc.)      │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### 1.3 Design Principles

1. **RESTful Design**: Resource-oriented URLs with standard HTTP methods
2. **Consistency**: Uniform response formats and error handling
3. **Security First**: API keys, rate limiting, audit logging
4. **Backward Compatibility**: Versioned endpoints with deprecation policy
5. **Performance**: Pagination, field selection, caching
6. **Idempotency**: Safe retry behavior for mutations

---

## 2. Authentication & Authorization

### 2.1 Authentication Methods

#### Method 1: API Keys (Primary for Agents)

```
Authorization: Bearer sp_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**API Key Structure:**
- Prefix: `sp_live_` (production) or `sp_test_` (sandbox)
- 32-character random string
- Stored hashed in database

**API Key Table Schema:**
```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                    -- Human-readable name
  key_hash TEXT NOT NULL UNIQUE,         -- SHA-256 hash of key
  key_prefix TEXT NOT NULL,              -- First 8 chars for identification
  owner_id UUID REFERENCES profiles(id), -- Key owner
  organization_id UUID,                  -- Optional org scoping
  scopes TEXT[] NOT NULL DEFAULT '{}',   -- Permitted scopes
  rate_limit_tier TEXT DEFAULT 'standard',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX idx_api_keys_owner ON api_keys(owner_id);
```

#### Method 2: OAuth 2.0 (Future - Third-party Apps)

For third-party integrations requiring user authorization:
- Authorization Code flow with PKCE
- Refresh token rotation
- Consent screen for scope approval

#### Method 3: Service Accounts (Internal Systems)

For internal microservices and background jobs:
- Long-lived tokens with elevated permissions
- IP allowlisting
- No user context required

### 2.2 Authorization Scopes

| Scope | Description | Endpoints |
|-------|-------------|-----------|
| `jobs:read` | Read job information | GET /jobs/* |
| `jobs:write` | Create/update jobs | POST/PUT/DELETE /jobs/* |
| `assignments:read` | Read crew assignments | GET /assignments/* |
| `assignments:write` | Manage assignments | POST/PUT/DELETE /assignments/* |
| `timesheets:read` | Read timesheet data | GET /timesheets/* |
| `timesheets:write` | Submit/edit timesheets | POST/PUT /timesheets/* |
| `timesheets:approve` | Approve/reject timesheets | PATCH /timesheets/*/approve |
| `tours:read` | Read tour information | GET /tours/* |
| `tours:write` | Manage tours | POST/PUT/DELETE /tours/* |
| `equipment:read` | Read equipment catalog | GET /equipment/* |
| `equipment:write` | Manage equipment | POST/PUT/DELETE /equipment/* |
| `crew:read` | Read technician profiles | GET /crew/* |
| `crew:write` | Manage technician data | PUT /crew/* |
| `availability:read` | Read availability | GET /availability/* |
| `availability:write` | Update availability | POST/PUT /availability/* |
| `staffing:read` | Read staffing requests | GET /staffing/* |
| `staffing:write` | Manage staffing | POST/PUT /staffing/* |
| `messages:read` | Read messages | GET /messages/* |
| `messages:write` | Send messages | POST /messages/* |
| `reports:read` | Generate reports | GET /reports/* |
| `admin:*` | Full administrative access | All endpoints |

### 2.3 Role-Based Access Control

API permissions respect existing platform roles:

| Role | Default Scopes | Restrictions |
|------|---------------|--------------|
| `admin` | All scopes | None |
| `management` | Most scopes | Cannot modify system settings |
| `logistics` | logistics:*, equipment:*, jobs:read | Limited to logistics operations |
| `house_tech` | jobs:read, assignments:read/write, timesheets:* | Own assignments only |
| `technician` | jobs:read, timesheets:read/write | Own data only |

### 2.4 API Key Management Endpoints

```
POST   /api/v1/api-keys           # Create new API key
GET    /api/v1/api-keys           # List user's API keys
GET    /api/v1/api-keys/:id       # Get key details (masked)
DELETE /api/v1/api-keys/:id       # Revoke API key
POST   /api/v1/api-keys/:id/rotate # Rotate key (returns new key)
```

---

## 3. API Versioning & Standards

### 3.1 Versioning Strategy

- **URL Path Versioning**: `/api/v1/`, `/api/v2/`
- **Header Fallback**: `X-API-Version: 2024-01-01` for minor versions
- **Deprecation Policy**: 12-month notice before version sunset

### 3.2 Base URL

```
Production: https://sector-pro.work/api/v1
Staging:    https://dev.sector-pro.work/api/v1
```

### 3.3 Request Format

**Headers:**
```http
Authorization: Bearer sp_live_xxxxx
Content-Type: application/json
Accept: application/json
X-Request-ID: uuid-for-tracing (optional)
X-Idempotency-Key: unique-key (for POST/PUT/PATCH)
```

**Query Parameters (Lists):**
```
?page=1                    # Page number (1-indexed)
&per_page=25               # Items per page (max 100)
&sort=created_at           # Sort field
&order=desc                # Sort order (asc/desc)
&fields=id,title,status    # Field selection
&expand=assignments,tour   # Include related resources
&filter[status]=confirmed  # Field filtering
&filter[start_time.gte]=2024-01-01
&search=festival           # Full-text search
```

### 3.4 Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { /* resource or array */ },
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 150,
    "total_pages": 6
  },
  "links": {
    "self": "/api/v1/jobs?page=1",
    "next": "/api/v1/jobs?page=2",
    "prev": null
  }
}
```

**Single Resource:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "type": "job",
    "attributes": { /* ... */ },
    "relationships": {
      "tour": { "id": "uuid", "type": "tour" },
      "assignments": [{ "id": "uuid", "type": "assignment" }]
    }
  }
}
```

### 3.5 Date/Time Format

- All timestamps in ISO 8601 format with timezone
- Default timezone: Europe/Madrid
- Example: `2024-06-15T20:00:00+02:00`

---

## 4. Endpoint Categories

### 4.1 Core Resources

| Category | Resource | Description |
|----------|----------|-------------|
| **Jobs** | `/jobs` | Individual shows, gigs, events |
| **Tours** | `/tours` | Tour/festival containers |
| **Assignments** | `/assignments` | Crew assignments to jobs |
| **Timesheets** | `/timesheets` | Time tracking records |
| **Crew** | `/crew` | Technician profiles |
| **Availability** | `/availability` | Technician availability |

### 4.2 Operations

| Category | Resource | Description |
|----------|----------|-------------|
| **Staffing** | `/staffing` | Staffing requests and workflow |
| **Equipment** | `/equipment` | Equipment catalog and inventory |
| **Logistics** | `/logistics` | Load-in/out, transport |
| **Messages** | `/messages` | Internal messaging |

### 4.3 Reporting & Analytics

| Category | Resource | Description |
|----------|----------|-------------|
| **Reports** | `/reports` | Generated reports (PDF, CSV) |
| **Analytics** | `/analytics` | Aggregated statistics |
| **Activity** | `/activity` | Audit log and activity feed |

### 4.4 System

| Category | Resource | Description |
|----------|----------|-------------|
| **Webhooks** | `/webhooks` | Webhook subscriptions |
| **API Keys** | `/api-keys` | API key management |
| **Health** | `/health` | System health check |

---

## 5. Detailed Endpoint Specifications

### 5.1 Jobs API

#### List Jobs
```http
GET /api/v1/jobs
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: pendiente, tentativa, confirmado, cancelado |
| `job_type` | string | Filter by type: single, festival, tourdate, evento, dryhire |
| `tour_id` | uuid | Filter by parent tour |
| `department` | string | Filter by department |
| `start_date` | date | Jobs starting on or after |
| `end_date` | date | Jobs ending on or before |
| `location_id` | uuid | Filter by location |
| `has_openings` | boolean | Only jobs with unfilled positions |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "job",
      "attributes": {
        "title": "Festival Primavera Sound - Day 1",
        "description": "Main stage sound crew",
        "status": "confirmado",
        "job_type": "festival",
        "start_time": "2024-06-01T08:00:00+02:00",
        "end_time": "2024-06-02T02:00:00+02:00",
        "location": {
          "id": "uuid",
          "name": "Parc del Fòrum",
          "city": "Barcelona"
        },
        "departments": ["sound", "lights"],
        "crew_count": {
          "required": 12,
          "confirmed": 10,
          "pending": 2
        },
        "created_at": "2024-01-15T10:30:00+01:00",
        "updated_at": "2024-01-20T14:45:00+01:00"
      },
      "relationships": {
        "tour": {
          "id": "tour-uuid",
          "type": "tour"
        }
      }
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 48
  }
}
```

#### Get Job
```http
GET /api/v1/jobs/:id
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `expand` | string | Comma-separated: assignments, tour, timesheets, equipment |

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "job",
    "attributes": {
      "title": "Festival Primavera Sound - Day 1",
      "description": "Main stage sound crew",
      "status": "confirmado",
      "job_type": "festival",
      "job_date_type": "show",
      "start_time": "2024-06-01T08:00:00+02:00",
      "end_time": "2024-06-02T02:00:00+02:00",
      "location": {
        "id": "uuid",
        "name": "Parc del Fòrum",
        "address": "Carrer de la Pau, 12",
        "city": "Barcelona",
        "country": "Spain",
        "coordinates": {
          "lat": 41.4103,
          "lng": 2.2209
        }
      },
      "departments": ["sound", "lights"],
      "required_roles": {
        "sound": [
          { "role": "FOH Engineer", "count": 2 },
          { "role": "Monitor Engineer", "count": 2 },
          { "role": "Stage Tech", "count": 4 }
        ],
        "lights": [
          { "role": "LD", "count": 1 },
          { "role": "Lights Tech", "count": 3 }
        ]
      },
      "notes": "Load-in at 06:00, soundcheck at 14:00",
      "color": "#3B82F6",
      "rates_approved": true,
      "invoicing_company": "SectorPro SL",
      "created_at": "2024-01-15T10:30:00+01:00",
      "updated_at": "2024-01-20T14:45:00+01:00"
    },
    "relationships": {
      "tour": {
        "data": {
          "id": "tour-uuid",
          "type": "tour",
          "attributes": {
            "name": "Primavera Sound 2024"
          }
        }
      },
      "assignments": {
        "data": [
          {
            "id": "assignment-uuid",
            "type": "assignment",
            "attributes": {
              "technician_id": "tech-uuid",
              "technician_name": "Juan García",
              "role": "FOH Engineer",
              "department": "sound",
              "status": "confirmed"
            }
          }
        ]
      }
    }
  }
}
```

#### Create Job
```http
POST /api/v1/jobs
```

**Request Body:**
```json
{
  "title": "Corporate Event - Tech Conference",
  "description": "Full AV setup for 500 attendees",
  "job_type": "evento",
  "start_time": "2024-07-15T08:00:00+02:00",
  "end_time": "2024-07-15T22:00:00+02:00",
  "location_id": "location-uuid",
  "tour_id": null,
  "departments": ["sound", "video"],
  "required_roles": {
    "sound": [
      { "role": "FOH Engineer", "count": 1 },
      { "role": "Stage Tech", "count": 2 }
    ],
    "video": [
      { "role": "Video Director", "count": 1 },
      { "role": "Camera Op", "count": 2 }
    ]
  },
  "notes": "Client contact: María López, +34 612 345 678",
  "color": "#10B981"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "new-job-uuid",
    "type": "job",
    "attributes": { /* full job object */ }
  }
}
```

#### Update Job
```http
PUT /api/v1/jobs/:id
```

**Request Body:** (partial updates supported)
```json
{
  "status": "confirmado",
  "notes": "Updated: Client confirmed catering requirements"
}
```

#### Delete Job
```http
DELETE /api/v1/jobs/:id
```

**Response:** `204 No Content`

#### Job Sub-Resources

```http
GET    /api/v1/jobs/:id/assignments      # List assignments for job
POST   /api/v1/jobs/:id/assignments      # Create assignment
GET    /api/v1/jobs/:id/timesheets       # List timesheets for job
GET    /api/v1/jobs/:id/equipment        # List allocated equipment
POST   /api/v1/jobs/:id/equipment        # Allocate equipment
GET    /api/v1/jobs/:id/documents        # List job documents
POST   /api/v1/jobs/:id/duplicate        # Duplicate job
```

---

### 5.2 Tours API

#### List Tours
```http
GET /api/v1/tours
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | active, completed, cancelled |
| `type` | string | tour, festival |
| `start_date` | date | Tours starting on or after |
| `end_date` | date | Tours ending on or before |
| `has_jobs` | boolean | Only tours with jobs |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tour-uuid",
      "type": "tour",
      "attributes": {
        "name": "Primavera Sound 2024",
        "description": "Annual music festival",
        "start_date": "2024-05-30",
        "end_date": "2024-06-02",
        "status": "active",
        "tour_type": "festival",
        "job_count": 4,
        "crew_count": 45,
        "flex_folder_id": "flex-uuid",
        "created_at": "2024-01-01T00:00:00+01:00"
      }
    }
  ]
}
```

#### Get Tour
```http
GET /api/v1/tours/:id
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `expand` | string | jobs, assignments, dates, accommodations |

#### Create Tour
```http
POST /api/v1/tours
```

**Request Body:**
```json
{
  "name": "Summer Festival Tour 2024",
  "description": "European summer festival circuit",
  "start_date": "2024-06-01",
  "end_date": "2024-08-31",
  "tour_type": "tour",
  "departments": ["sound", "lights", "video"],
  "settings": {
    "auto_create_timesheets": true,
    "default_rates": "rate_card_2025"
  }
}
```

#### Tour Sub-Resources

```http
GET    /api/v1/tours/:id/dates           # List tour dates
POST   /api/v1/tours/:id/dates           # Add tour date
GET    /api/v1/tours/:id/jobs            # List jobs in tour
POST   /api/v1/tours/:id/jobs            # Create job in tour
GET    /api/v1/tours/:id/assignments     # List tour assignments
POST   /api/v1/tours/:id/assignments     # Assign crew to tour
GET    /api/v1/tours/:id/accommodations  # List accommodations
POST   /api/v1/tours/:id/accommodations  # Add accommodation
GET    /api/v1/tours/:id/itinerary       # Get full itinerary
GET    /api/v1/tours/:id/documents       # List documents
POST   /api/v1/tours/:id/export          # Export tour book (PDF)
```

---

### 5.3 Assignments API

#### List Assignments
```http
GET /api/v1/assignments
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | uuid | Filter by job |
| `tour_id` | uuid | Filter by tour |
| `technician_id` | uuid | Filter by technician |
| `department` | string | Filter by department |
| `status` | string | invited, confirmed, declined |
| `date` | date | Assignments on specific date |
| `date_from` | date | Assignments from date |
| `date_to` | date | Assignments to date |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "assignment-uuid",
      "type": "assignment",
      "attributes": {
        "job_id": "job-uuid",
        "technician_id": "tech-uuid",
        "department": "sound",
        "role": "FOH Engineer",
        "status": "confirmed",
        "travel_required": true,
        "accommodation_provided": true,
        "per_diem": 50.00,
        "notes": "Driving - will bring PA system",
        "confirmed_at": "2024-05-15T10:00:00+02:00",
        "created_at": "2024-05-10T14:30:00+02:00"
      },
      "relationships": {
        "job": {
          "id": "job-uuid",
          "type": "job",
          "attributes": {
            "title": "Festival Day 1",
            "start_time": "2024-06-01T08:00:00+02:00"
          }
        },
        "technician": {
          "id": "tech-uuid",
          "type": "crew",
          "attributes": {
            "name": "Juan García",
            "phone": "+34 612 345 678"
          }
        }
      }
    }
  ]
}
```

#### Create Assignment
```http
POST /api/v1/assignments
```

**Request Body:**
```json
{
  "job_id": "job-uuid",
  "technician_id": "tech-uuid",
  "department": "sound",
  "role": "FOH Engineer",
  "travel_required": true,
  "accommodation_provided": true,
  "per_diem": 50.00,
  "notes": "Requires PA system transport",
  "send_notification": true
}
```

#### Update Assignment Status
```http
PATCH /api/v1/assignments/:id/status
```

**Request Body:**
```json
{
  "status": "confirmed",
  "notes": "Accepted via phone call"
}
```

#### Bulk Assignment Operations
```http
POST /api/v1/assignments/bulk
```

**Request Body:**
```json
{
  "operation": "create",
  "assignments": [
    {
      "job_id": "job-uuid-1",
      "technician_id": "tech-uuid",
      "department": "sound",
      "role": "Stage Tech"
    },
    {
      "job_id": "job-uuid-2",
      "technician_id": "tech-uuid",
      "department": "sound",
      "role": "Stage Tech"
    }
  ],
  "send_notifications": true
}
```

#### Check Conflicts
```http
POST /api/v1/assignments/check-conflicts
```

**Request Body:**
```json
{
  "technician_id": "tech-uuid",
  "job_id": "job-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "has_conflicts": true,
    "conflicts": [
      {
        "job_id": "conflicting-job-uuid",
        "job_title": "Other Festival",
        "start_time": "2024-06-01T10:00:00+02:00",
        "end_time": "2024-06-01T23:00:00+02:00",
        "overlap_hours": 4.5
      }
    ]
  }
}
```

---

### 5.4 Timesheets API

#### List Timesheets
```http
GET /api/v1/timesheets
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | uuid | Filter by job |
| `tour_id` | uuid | Filter by tour |
| `technician_id` | uuid | Filter by technician |
| `status` | string | draft, submitted, approved, rejected |
| `date` | date | Timesheets for specific date |
| `date_from` | date | Timesheets from date |
| `date_to` | date | Timesheets to date |
| `department` | string | Filter by department |
| `needs_approval` | boolean | Only pending approval |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "timesheet-uuid",
      "type": "timesheet",
      "attributes": {
        "job_id": "job-uuid",
        "technician_id": "tech-uuid",
        "date": "2024-06-01",
        "start_time": "08:00",
        "end_time": "02:00",
        "break_minutes": 60,
        "status": "submitted",
        "hours_breakdown": {
          "regular_hours": 8.0,
          "overtime_hours": 2.0,
          "night_hours": 4.0,
          "holiday_hours": 0,
          "total_hours": 17.0
        },
        "amount_breakdown": {
          "base_amount": 200.00,
          "overtime_amount": 75.00,
          "night_bonus": 40.00,
          "holiday_bonus": 0,
          "per_diem": 50.00,
          "travel_allowance": 30.00,
          "total_amount": 395.00
        },
        "notes": "Extended due to delayed load-out",
        "submitted_at": "2024-06-02T10:00:00+02:00",
        "created_at": "2024-06-01T08:00:00+02:00"
      },
      "relationships": {
        "job": { "id": "job-uuid", "type": "job" },
        "technician": { "id": "tech-uuid", "type": "crew" }
      }
    }
  ]
}
```

#### Get Timesheet
```http
GET /api/v1/timesheets/:id
```

#### Create Timesheet
```http
POST /api/v1/timesheets
```

**Request Body:**
```json
{
  "job_id": "job-uuid",
  "technician_id": "tech-uuid",
  "date": "2024-06-01",
  "start_time": "08:00",
  "end_time": "23:00",
  "break_minutes": 60,
  "notes": "Regular show day"
}
```

#### Update Timesheet
```http
PUT /api/v1/timesheets/:id
```

**Request Body:**
```json
{
  "start_time": "07:30",
  "end_time": "00:30",
  "break_minutes": 45,
  "notes": "Updated: early call time, late finish"
}
```

#### Submit Timesheet
```http
POST /api/v1/timesheets/:id/submit
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "timesheet-uuid",
    "status": "submitted",
    "submitted_at": "2024-06-02T10:00:00+02:00"
  }
}
```

#### Approve/Reject Timesheet
```http
PATCH /api/v1/timesheets/:id/review
```

**Request Body:**
```json
{
  "action": "approve",
  "notes": "Verified with production manager"
}
```

or

```json
{
  "action": "reject",
  "reason": "Incorrect break time - please verify"
}
```

#### Bulk Timesheet Operations
```http
POST /api/v1/timesheets/bulk
```

**Request Body:**
```json
{
  "operation": "approve",
  "timesheet_ids": ["uuid-1", "uuid-2", "uuid-3"],
  "notes": "Batch approval for June tour dates"
}
```

#### Calculate Timesheet Amount
```http
POST /api/v1/timesheets/:id/calculate
```

**Response:**
```json
{
  "success": true,
  "data": {
    "hours_breakdown": {
      "regular_hours": 8.0,
      "overtime_hours": 2.0,
      "night_hours": 4.0,
      "total_hours": 14.0
    },
    "amount_breakdown": {
      "base_amount": 200.00,
      "overtime_amount": 75.00,
      "night_bonus": 40.00,
      "total_amount": 315.00
    },
    "rate_card_used": "rate_cards_2025",
    "custom_rate_applied": false
  }
}
```

---

### 5.5 Crew API

#### List Crew
```http
GET /api/v1/crew
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `department` | string | Filter by primary department |
| `role` | string | Filter by user role |
| `skill` | string | Filter by skill |
| `available_on` | date | Available on specific date |
| `available_from` | date | Available from date |
| `available_to` | date | Available to date |
| `search` | string | Search name, email, phone |
| `active` | boolean | Only active technicians |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "tech-uuid",
      "type": "crew",
      "attributes": {
        "first_name": "Juan",
        "last_name": "García",
        "nickname": "Juancho",
        "email": "juan@example.com",
        "phone": "+34 612 345 678",
        "department": "sound",
        "role": "technician",
        "skills": ["FOH", "Monitors", "RF", "Dante"],
        "certifications": ["PRS", "First Aid"],
        "dni": "12345678A",
        "residencia": "Madrid",
        "profile_picture_url": "https://...",
        "emergency_contact": {
          "name": "María García",
          "phone": "+34 612 345 679",
          "relationship": "Spouse"
        },
        "stats": {
          "total_jobs": 45,
          "jobs_this_month": 8,
          "rating": 4.8
        },
        "created_at": "2023-01-15T00:00:00+01:00"
      }
    }
  ]
}
```

#### Get Crew Member
```http
GET /api/v1/crew/:id
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `expand` | string | assignments, timesheets, availability, skills |

#### Update Crew Member
```http
PUT /api/v1/crew/:id
```

**Request Body:**
```json
{
  "phone": "+34 612 345 999",
  "skills": ["FOH", "Monitors", "RF", "Dante", "d&b"],
  "emergency_contact": {
    "name": "Updated Contact",
    "phone": "+34 612 000 000"
  }
}
```

#### Crew Sub-Resources

```http
GET    /api/v1/crew/:id/assignments      # List technician's assignments
GET    /api/v1/crew/:id/timesheets       # List technician's timesheets
GET    /api/v1/crew/:id/availability     # Get availability calendar
PUT    /api/v1/crew/:id/availability     # Update availability
GET    /api/v1/crew/:id/skills           # List skills
PUT    /api/v1/crew/:id/skills           # Update skills
GET    /api/v1/crew/:id/documents        # List documents (certs, etc)
GET    /api/v1/crew/:id/stats            # Get performance stats
```

---

### 5.6 Availability API

#### Get Availability Calendar
```http
GET /api/v1/availability
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `technician_id` | uuid | Filter by technician |
| `department` | string | Filter by department |
| `date_from` | date | Start of range (required) |
| `date_to` | date | End of range (required) |
| `status` | string | available, unavailable, tentative |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "avail-uuid",
      "type": "availability",
      "attributes": {
        "technician_id": "tech-uuid",
        "date": "2024-06-15",
        "status": "available",
        "start_time": "08:00",
        "end_time": "23:00",
        "notes": "Prefer morning calls",
        "has_assignment": false
      }
    },
    {
      "id": "avail-uuid-2",
      "type": "availability",
      "attributes": {
        "technician_id": "tech-uuid",
        "date": "2024-06-16",
        "status": "unavailable",
        "reason": "Personal commitment",
        "has_assignment": false
      }
    }
  ]
}
```

#### Set Availability
```http
POST /api/v1/availability
```

**Request Body:**
```json
{
  "technician_id": "tech-uuid",
  "entries": [
    {
      "date": "2024-06-15",
      "status": "available",
      "start_time": "08:00",
      "end_time": "23:00"
    },
    {
      "date": "2024-06-16",
      "status": "unavailable",
      "reason": "Doctor appointment"
    }
  ]
}
```

#### Bulk Availability Update
```http
PUT /api/v1/availability/bulk
```

**Request Body:**
```json
{
  "technician_id": "tech-uuid",
  "date_from": "2024-07-01",
  "date_to": "2024-07-31",
  "status": "available",
  "exclude_dates": ["2024-07-15", "2024-07-16"]
}
```

#### Find Available Crew
```http
POST /api/v1/availability/search
```

**Request Body:**
```json
{
  "date": "2024-06-15",
  "department": "sound",
  "skills": ["FOH"],
  "location": "Madrid",
  "exclude_technician_ids": ["already-assigned-uuid"]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "technician_id": "tech-uuid",
      "name": "Juan García",
      "availability_status": "available",
      "distance_km": 15,
      "skills_match": ["FOH", "Monitors"],
      "last_job_date": "2024-06-10",
      "rating": 4.8
    }
  ]
}
```

---

### 5.7 Staffing API

#### List Staffing Requests
```http
GET /api/v1/staffing
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `job_id` | uuid | Filter by job |
| `tour_id` | uuid | Filter by tour |
| `department` | string | Filter by department |
| `status` | string | open, partially_filled, filled, cancelled |
| `urgent` | boolean | Only urgent requests |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "staffing-uuid",
      "type": "staffing_request",
      "attributes": {
        "job_id": "job-uuid",
        "department": "sound",
        "role": "FOH Engineer",
        "quantity_needed": 2,
        "quantity_filled": 1,
        "status": "partially_filled",
        "priority": "high",
        "requirements": {
          "skills": ["d&b", "DiGiCo"],
          "certifications": ["PRS"],
          "experience_years": 3
        },
        "notes": "Must have own transport",
        "deadline": "2024-05-20T18:00:00+02:00",
        "created_at": "2024-05-15T10:00:00+02:00"
      }
    }
  ]
}
```

#### Create Staffing Request
```http
POST /api/v1/staffing
```

**Request Body:**
```json
{
  "job_id": "job-uuid",
  "department": "sound",
  "roles": [
    {
      "role": "FOH Engineer",
      "quantity": 2,
      "requirements": {
        "skills": ["d&b", "DiGiCo"],
        "experience_years": 3
      }
    },
    {
      "role": "Stage Tech",
      "quantity": 4
    }
  ],
  "priority": "high",
  "notes": "International artist - English required",
  "auto_invite": true,
  "invite_preferences": {
    "prefer_previous_crew": true,
    "max_distance_km": 100
  }
}
```

#### Invite Technician to Staffing Request
```http
POST /api/v1/staffing/:id/invite
```

**Request Body:**
```json
{
  "technician_ids": ["tech-uuid-1", "tech-uuid-2"],
  "message": "We have an opening for Primavera Sound. Interested?",
  "deadline": "2024-05-18T18:00:00+02:00"
}
```

#### Auto-Staff Job
```http
POST /api/v1/staffing/auto-assign
```

**Request Body:**
```json
{
  "job_id": "job-uuid",
  "department": "sound",
  "strategy": "best_match",
  "constraints": {
    "max_distance_km": 50,
    "prefer_previous_crew": true,
    "min_rating": 4.0
  },
  "dry_run": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dry_run": true,
    "proposed_assignments": [
      {
        "technician_id": "tech-uuid",
        "name": "Juan García",
        "role": "FOH Engineer",
        "match_score": 0.95,
        "reasons": [
          "Worked previous 3 shows on tour",
          "Has required skills",
          "Lives 10km from venue"
        ]
      }
    ],
    "unfilled_roles": [
      {
        "role": "Stage Tech",
        "quantity": 2,
        "reason": "No available technicians with required skills"
      }
    ]
  }
}
```

---

### 5.8 Equipment API

#### List Equipment
```http
GET /api/v1/equipment
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | speakers, consoles, microphones, etc. |
| `department` | string | sound, lights, video |
| `available` | boolean | Only available items |
| `available_on` | date | Available on specific date |
| `search` | string | Search name, model, brand |

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "equipment-uuid",
      "type": "equipment",
      "attributes": {
        "name": "d&b E12",
        "brand": "d&b audiotechnik",
        "model": "E12",
        "category": "speakers",
        "department": "sound",
        "quantity_total": 24,
        "quantity_available": 18,
        "daily_rate": 50.00,
        "weight_kg": 23.5,
        "dimensions": {
          "width": 350,
          "height": 594,
          "depth": 367
        },
        "power_requirements": "800W",
        "notes": "Flying hardware included",
        "image_url": "https://..."
      }
    }
  ]
}
```

#### Get Equipment Item
```http
GET /api/v1/equipment/:id
```

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `expand` | string | allocations, movements, maintenance |

#### Check Equipment Availability
```http
POST /api/v1/equipment/check-availability
```

**Request Body:**
```json
{
  "items": [
    { "equipment_id": "uuid-1", "quantity": 12 },
    { "equipment_id": "uuid-2", "quantity": 4 }
  ],
  "date_from": "2024-06-01",
  "date_to": "2024-06-03"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "all_available": false,
    "items": [
      {
        "equipment_id": "uuid-1",
        "name": "d&b E12",
        "requested": 12,
        "available": 12,
        "status": "available"
      },
      {
        "equipment_id": "uuid-2",
        "name": "DiGiCo SD12",
        "requested": 4,
        "available": 2,
        "status": "partial",
        "conflicts": [
          {
            "job_id": "job-uuid",
            "job_title": "Other Show",
            "quantity_allocated": 2
          }
        ]
      }
    ]
  }
}
```

#### Allocate Equipment to Job
```http
POST /api/v1/equipment/allocate
```

**Request Body:**
```json
{
  "job_id": "job-uuid",
  "allocations": [
    { "equipment_id": "uuid-1", "quantity": 12 },
    { "equipment_id": "uuid-2", "quantity": 2 }
  ],
  "notes": "Main PA for stage A"
}
```

#### Equipment Presets
```http
GET    /api/v1/equipment/presets         # List presets
POST   /api/v1/equipment/presets         # Create preset
GET    /api/v1/equipment/presets/:id     # Get preset details
PUT    /api/v1/equipment/presets/:id     # Update preset
DELETE /api/v1/equipment/presets/:id     # Delete preset
POST   /api/v1/equipment/presets/:id/apply # Apply preset to job
```

---

### 5.9 Messages API

#### List Conversations
```http
GET /api/v1/messages/conversations
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv-uuid",
      "type": "conversation",
      "attributes": {
        "participants": [
          { "id": "user-1", "name": "Juan García" },
          { "id": "user-2", "name": "María López" }
        ],
        "last_message": {
          "content": "See you at load-in tomorrow",
          "sender_id": "user-1",
          "sent_at": "2024-05-31T18:30:00+02:00"
        },
        "unread_count": 2,
        "job_id": "job-uuid",
        "job_title": "Festival Day 1"
      }
    }
  ]
}
```

#### List Messages in Conversation
```http
GET /api/v1/messages/conversations/:id/messages
```

#### Send Message
```http
POST /api/v1/messages
```

**Request Body:**
```json
{
  "recipient_ids": ["user-uuid-1", "user-uuid-2"],
  "content": "Load-in time changed to 07:00. Please confirm.",
  "job_id": "job-uuid",
  "priority": "high"
}
```

#### Send Announcement
```http
POST /api/v1/messages/announcements
```

**Request Body:**
```json
{
  "title": "Office Closure - August 15",
  "content": "The office will be closed for the public holiday.",
  "target": {
    "type": "department",
    "departments": ["sound", "lights"]
  },
  "priority": "normal",
  "expires_at": "2024-08-16T00:00:00+02:00"
}
```

---

### 5.10 Reports API

#### Generate Report
```http
POST /api/v1/reports
```

**Request Body:**
```json
{
  "type": "tour_summary",
  "format": "pdf",
  "parameters": {
    "tour_id": "tour-uuid",
    "include_timesheets": true,
    "include_expenses": true,
    "date_range": {
      "from": "2024-06-01",
      "to": "2024-06-30"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "report-uuid",
    "status": "processing",
    "estimated_completion": "2024-06-15T10:05:00+02:00"
  }
}
```

#### Get Report Status
```http
GET /api/v1/reports/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report_id": "report-uuid",
    "status": "completed",
    "download_url": "https://storage.../report.pdf",
    "expires_at": "2024-06-16T10:00:00+02:00",
    "metadata": {
      "pages": 15,
      "file_size_bytes": 2048576
    }
  }
}
```

#### Available Report Types

| Type | Description | Parameters |
|------|-------------|------------|
| `tour_summary` | Complete tour overview | tour_id, date_range |
| `tour_book` | Full tour book PDF | tour_id |
| `timesheet_export` | Timesheet data export | date_range, department, technician_id |
| `payroll_report` | Payroll summary | date_range, department |
| `crew_schedule` | Crew schedule calendar | date_range, technician_ids |
| `equipment_usage` | Equipment utilization | date_range, category |
| `job_sheet` | Individual job sheet | job_id |
| `memoria_tecnica` | Technical specification | job_id, department |

---

### 5.11 Webhooks API

#### List Webhook Subscriptions
```http
GET /api/v1/webhooks
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "webhook-uuid",
      "type": "webhook",
      "attributes": {
        "url": "https://your-server.com/webhooks/sectorpro",
        "events": ["job.created", "assignment.confirmed", "timesheet.submitted"],
        "secret": "whsec_xxxxx",
        "active": true,
        "created_at": "2024-01-15T00:00:00+01:00",
        "last_triggered_at": "2024-05-31T14:30:00+02:00",
        "failure_count": 0
      }
    }
  ]
}
```

#### Create Webhook Subscription
```http
POST /api/v1/webhooks
```

**Request Body:**
```json
{
  "url": "https://your-server.com/webhooks/sectorpro",
  "events": [
    "job.created",
    "job.updated",
    "job.deleted",
    "assignment.created",
    "assignment.confirmed",
    "assignment.declined",
    "timesheet.submitted",
    "timesheet.approved",
    "staffing.request_created",
    "equipment.allocated"
  ],
  "secret": "your-webhook-secret"
}
```

#### Update Webhook
```http
PUT /api/v1/webhooks/:id
```

#### Delete Webhook
```http
DELETE /api/v1/webhooks/:id
```

#### Test Webhook
```http
POST /api/v1/webhooks/:id/test
```

#### Webhook Payload Format

```json
{
  "id": "event-uuid",
  "type": "job.created",
  "created_at": "2024-06-01T10:00:00+02:00",
  "data": {
    "job": {
      "id": "job-uuid",
      "title": "New Festival Job",
      "status": "pendiente"
    }
  },
  "metadata": {
    "triggered_by": "user-uuid",
    "api_version": "v1"
  }
}
```

**Webhook Signature:**
```
X-Webhook-Signature: sha256=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

### 5.12 System Endpoints

#### Health Check
```http
GET /api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-06-01T10:00:00+02:00",
  "services": {
    "database": "healthy",
    "storage": "healthy",
    "realtime": "healthy"
  }
}
```

#### API Info
```http
GET /api/v1
```

**Response:**
```json
{
  "name": "Sector Pro API",
  "version": "1.0.0",
  "documentation": "https://docs.sector-pro.work/api",
  "endpoints": {
    "jobs": "/api/v1/jobs",
    "tours": "/api/v1/tours",
    "assignments": "/api/v1/assignments",
    "timesheets": "/api/v1/timesheets",
    "crew": "/api/v1/crew",
    "equipment": "/api/v1/equipment"
  }
}
```

#### Rate Limit Status
```http
GET /api/v1/rate-limit
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tier": "standard",
    "limits": {
      "requests_per_minute": 60,
      "requests_per_day": 10000
    },
    "current": {
      "minute": 15,
      "day": 1234
    },
    "reset_at": {
      "minute": "2024-06-01T10:01:00+02:00",
      "day": "2024-06-02T00:00:00+02:00"
    }
  }
}
```

---

## 6. Rate Limiting & Quotas

### 6.1 Rate Limit Tiers

| Tier | Requests/Min | Requests/Day | Burst | Use Case |
|------|--------------|--------------|-------|----------|
| `free` | 20 | 1,000 | 5 | Development/testing |
| `standard` | 60 | 10,000 | 20 | Normal integrations |
| `professional` | 300 | 100,000 | 50 | High-volume agents |
| `enterprise` | 1,000 | Unlimited | 200 | Enterprise clients |

### 6.2 Rate Limit Headers

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1717236060
X-RateLimit-Tier: standard
```

### 6.3 Rate Limit Response

When rate limited:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please retry after 45 seconds.",
    "retry_after": 45
  }
}
```

---

## 7. Error Handling

### 7.1 Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "start_time",
        "message": "Start time must be before end time"
      },
      {
        "field": "department",
        "message": "Invalid department: 'audio'. Valid values: sound, lights, video"
      }
    ],
    "request_id": "req_xxxxxxxxxxxxx"
  }
}
```

### 7.2 Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request parameters |
| 400 | `INVALID_JSON` | Malformed JSON body |
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 401 | `TOKEN_EXPIRED` | API key has expired |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `SCOPE_REQUIRED` | Missing required scope |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource conflict (e.g., duplicate) |
| 409 | `ASSIGNMENT_CONFLICT` | Technician already assigned |
| 422 | `UNPROCESSABLE` | Business logic error |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Temporary unavailability |

### 7.3 Idempotency

For POST/PUT/PATCH requests, use idempotency keys:

```http
X-Idempotency-Key: unique-request-id-12345
```

- Keys are valid for 24 hours
- Duplicate requests return cached response
- Prevents double-creation on network retries

---

## 8. Webhooks & Events

### 8.1 Available Events

#### Job Events
- `job.created` - New job created
- `job.updated` - Job details updated
- `job.status_changed` - Job status changed
- `job.deleted` - Job deleted

#### Assignment Events
- `assignment.created` - New assignment created
- `assignment.confirmed` - Technician confirmed
- `assignment.declined` - Technician declined
- `assignment.cancelled` - Assignment cancelled

#### Timesheet Events
- `timesheet.created` - Timesheet created
- `timesheet.submitted` - Timesheet submitted for approval
- `timesheet.approved` - Timesheet approved
- `timesheet.rejected` - Timesheet rejected

#### Tour Events
- `tour.created` - New tour created
- `tour.updated` - Tour details updated
- `tour.date_added` - New date added to tour
- `tour.completed` - Tour marked complete

#### Staffing Events
- `staffing.request_created` - New staffing request
- `staffing.request_filled` - Staffing request filled
- `staffing.invitation_sent` - Invitation sent to technician
- `staffing.invitation_responded` - Technician responded

#### Equipment Events
- `equipment.allocated` - Equipment allocated to job
- `equipment.returned` - Equipment returned
- `equipment.shortage` - Equipment shortage detected

#### Crew Events
- `crew.availability_updated` - Technician updated availability
- `crew.profile_updated` - Profile information changed

### 8.2 Webhook Security

1. **Signature Verification**: All webhooks signed with HMAC-SHA256
2. **Timestamp Validation**: Reject events older than 5 minutes
3. **Retry Policy**: 3 retries with exponential backoff (1m, 5m, 30m)
4. **Failure Handling**: Disable webhook after 10 consecutive failures

### 8.3 Webhook Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhookSignature(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(`sha256=${expectedSignature}`)
  );
}
```

---

## 9. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)

**Goals**: Core infrastructure and authentication

**Deliverables**:
1. API Gateway edge function with routing
2. Authentication middleware (API keys)
3. Rate limiting implementation
4. Error handling framework
5. Request/response logging
6. API key management endpoints
7. Health check endpoint
8. OpenAPI specification scaffold

**Endpoints**:
- `POST /api/v1/api-keys`
- `GET /api/v1/api-keys`
- `DELETE /api/v1/api-keys/:id`
- `GET /api/v1/health`
- `GET /api/v1`

**Database Changes**:
- `api_keys` table
- `api_request_logs` table
- `api_rate_limits` table

---

### Phase 2: Core Resources (Weeks 4-6)

**Goals**: Jobs, Tours, Assignments CRUD

**Deliverables**:
1. Jobs API (full CRUD)
2. Tours API (full CRUD)
3. Assignments API (full CRUD)
4. Sub-resource endpoints
5. Filtering, pagination, sorting
6. Field selection and expansion

**Endpoints**:
- Full Jobs API (`/api/v1/jobs/*`)
- Full Tours API (`/api/v1/tours/*`)
- Full Assignments API (`/api/v1/assignments/*`)
- Conflict checking endpoint

---

### Phase 3: Crew & Scheduling (Weeks 7-9)

**Goals**: Crew management and availability

**Deliverables**:
1. Crew API (read, limited write)
2. Availability API (full CRUD)
3. Staffing API (requests, invitations)
4. Auto-staffing suggestions
5. Bulk operations

**Endpoints**:
- Full Crew API (`/api/v1/crew/*`)
- Full Availability API (`/api/v1/availability/*`)
- Full Staffing API (`/api/v1/staffing/*`)

---

### Phase 4: Timesheets & Payroll (Weeks 10-11)

**Goals**: Time tracking and approval workflows

**Deliverables**:
1. Timesheets API (full CRUD)
2. Submit/approve workflow
3. Bulk operations
4. Amount calculations
5. Rate card integration

**Endpoints**:
- Full Timesheets API (`/api/v1/timesheets/*`)
- Calculation endpoints
- Bulk approval endpoints

---

### Phase 5: Equipment (Weeks 12-13)

**Goals**: Equipment catalog and allocation

**Deliverables**:
1. Equipment catalog API
2. Availability checking
3. Allocation management
4. Presets API

**Endpoints**:
- Full Equipment API (`/api/v1/equipment/*`)
- Presets endpoints
- Allocation endpoints

---

### Phase 6: Communication & Webhooks (Weeks 14-15)

**Goals**: Messaging and event notifications

**Deliverables**:
1. Messages API
2. Announcements API
3. Webhook subscription management
4. Event dispatch system
5. Webhook delivery with retries

**Endpoints**:
- Full Messages API (`/api/v1/messages/*`)
- Full Webhooks API (`/api/v1/webhooks/*`)

---

### Phase 7: Reports & Polish (Weeks 16-18)

**Goals**: Reporting and production readiness

**Deliverables**:
1. Reports API (async generation)
2. Analytics endpoints
3. Activity/audit log API
4. Complete OpenAPI documentation
5. SDK generation (TypeScript, Python)
6. Developer portal
7. Performance optimization
8. Security audit

**Endpoints**:
- Full Reports API (`/api/v1/reports/*`)
- Analytics API (`/api/v1/analytics/*`)
- Activity API (`/api/v1/activity/*`)

---

## 10. Security Considerations

### 10.1 Authentication Security

- API keys stored as SHA-256 hashes
- Keys rotatable without service interruption
- Automatic expiration support
- IP allowlisting (optional)
- Scope-based least-privilege access

### 10.2 Data Security

- All traffic over HTTPS (TLS 1.3)
- Sensitive fields redacted in logs
- PII access requires explicit scopes
- Rate limiting per key and IP
- Request size limits (10MB max)

### 10.3 Audit Logging

All API requests logged with:
- Request ID
- API key (prefix only)
- Endpoint and method
- Response status
- Response time
- IP address
- User agent

### 10.4 Input Validation

- JSON schema validation on all inputs
- SQL injection prevention via parameterized queries
- XSS prevention (output encoding)
- Path traversal prevention
- File upload restrictions

### 10.5 Rate Limiting Protections

- Per-key rate limits
- Per-IP rate limits
- Endpoint-specific limits (sensitive operations)
- Burst protection
- Automatic temporary bans for abuse

---

## 11. Testing Strategy

### 11.1 Test Categories

1. **Unit Tests**: Individual function logic
2. **Integration Tests**: Database operations
3. **API Tests**: Full endpoint testing
4. **Load Tests**: Performance under load
5. **Security Tests**: Penetration testing

### 11.2 Test Environment

- Dedicated test database
- Test API keys with `sp_test_` prefix
- Isolated from production data
- Automatic cleanup after tests

### 11.3 CI/CD Integration

```yaml
# Example GitHub Actions workflow
test-api:
  runs-on: ubuntu-latest
  steps:
    - name: Run API Tests
      run: npm run test:api
    - name: Run Load Tests
      run: npm run test:load
    - name: Security Scan
      run: npm run test:security
```

---

## 12. Documentation

### 12.1 OpenAPI Specification

Full OpenAPI 3.0 specification at:
- `/api/v1/openapi.json`
- `/api/v1/openapi.yaml`

### 12.2 Developer Portal

Interactive documentation including:
- Getting started guide
- Authentication tutorial
- Code examples (cURL, JavaScript, Python)
- API reference
- Changelog
- Status page

### 12.3 SDK Support

Auto-generated SDKs:
- TypeScript/JavaScript
- Python
- Go (future)

### 12.4 Example: TypeScript SDK Usage

```typescript
import { SectorProClient } from '@sector-pro/sdk';

const client = new SectorProClient({
  apiKey: 'sp_live_xxxxx',
  baseUrl: 'https://sector-pro.work/api/v1'
});

// List upcoming jobs
const jobs = await client.jobs.list({
  status: 'confirmado',
  startDate: '2024-06-01',
  expand: ['assignments', 'tour']
});

// Create assignment
const assignment = await client.assignments.create({
  jobId: 'job-uuid',
  technicianId: 'tech-uuid',
  department: 'sound',
  role: 'FOH Engineer'
});

// Check conflicts before assignment
const conflicts = await client.assignments.checkConflicts({
  technicianId: 'tech-uuid',
  jobId: 'job-uuid'
});
```

---

## Appendix A: Database Schema Additions

### New Tables Required

```sql
-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  owner_id UUID REFERENCES profiles(id),
  scopes TEXT[] NOT NULL DEFAULT '{}',
  rate_limit_tier TEXT DEFAULT 'standard',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);

-- API Request Logs
CREATE TABLE api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhooks
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES profiles(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Webhook Deliveries
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Idempotency Keys
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  api_key_id UUID REFERENCES api_keys(id),
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '24 hours'
);
```

---

## Appendix B: Edge Function Structure

```
supabase/functions/
├── api-gateway/
│   └── index.ts           # Main router
├── _shared/
│   ├── auth.ts            # Authentication middleware
│   ├── rate-limit.ts      # Rate limiting logic
│   ├── validation.ts      # Request validation
│   ├── errors.ts          # Error handling
│   ├── response.ts        # Response formatting
│   └── logger.ts          # Logging utilities
├── api-jobs/
│   └── index.ts           # Jobs endpoints
├── api-tours/
│   └── index.ts           # Tours endpoints
├── api-assignments/
│   └── index.ts           # Assignments endpoints
├── api-timesheets/
│   └── index.ts           # Timesheets endpoints
├── api-crew/
│   └── index.ts           # Crew endpoints
├── api-equipment/
│   └── index.ts           # Equipment endpoints
├── api-webhooks/
│   └── index.ts           # Webhook management
└── webhook-dispatcher/
    └── index.ts           # Webhook delivery worker
```

---

## Appendix C: Migration Path

For existing integrations:

1. **Phase 1**: API runs alongside existing edge functions
2. **Phase 2**: Deprecation notices for direct Supabase access
3. **Phase 3**: API becomes primary integration method
4. **Phase 4**: Direct database access restricted to internal services

---

*Document Version: 1.0.0*
*Last Updated: 2024-06-01*
*Authors: Sector Pro Engineering Team*
