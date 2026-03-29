# SoundVision File Library

> File management for SoundVision venue files with access request and review workflow.

## Overview

The SoundVision file library manages venue acoustic simulation files (SoundVision format). Access is controlled: users must request access, which admins approve or deny. Approved users can download files. A review workflow allows feedback on uploaded files.

## Key Files

| Category | Path |
|----------|------|
| **Page** | `src/pages/SoundVisionFiles.tsx` |
| **File queries** | `src/hooks/useSoundVisionFiles.ts` (11KB) |
| **Upload** | `src/hooks/useSoundVisionUpload.ts` (4.8KB) |
| **Access requests** | `src/hooks/useSoundVisionAccessRequest.ts` (6.6KB) |
| **File reviews** | `src/hooks/useSoundVisionFileReviews.ts` (5.9KB) |
| **File validation** | `src/utils/soundvisionFileValidation.ts` |
| **Access guard** | `src/hooks/useOptimizedAuth.tsx` (`hasSoundVisionAccess` property) + `ProtectedRoute` in `src/App.tsx` |

## Access Control Model

```text
1. USER visits SoundVision Files page
2. ACCESS CHECK → user must have approved access or be admin/management
3. IF NO ACCESS → shows "Request Access" button
4. USER requests access → creates access_request record
5. ADMIN reviews request → approves or denies
6. IF APPROVED → user can browse and download files
7. IF DENIED → user sees denial message
```

## Workflows

### File Upload (Admin/Management)
```text
1. SELECT files (SoundVision format validated)
2. UPLOAD to Supabase storage
3. METADATA saved (file name, size, type, uploader)
4. FILE available to approved users
```

### Access Request
```text
1. USER clicks "Request Access"
2. REQUEST created with user_id, status = 'pending'
3. ADMIN notified
4. ADMIN approves/denies
5. USER notified of decision
```

### File Review
```text
1. REVIEWER opens file details
2. SUBMITS review (comments, rating)
3. REVIEW visible to file uploader and admins
4. UPLOADER can respond to review
```

## Documentation

Detailed workflow documentation already exists:
- `docs/soundvision-access-workflow.md` — Full access control workflow
- `docs/soundvision-access-test-cases.md` — Test scenarios
- `docs/SOUNDVISION_ACCESS_CHANGES.md` — Change history
