# Flex URL Builder

Centralized module for constructing Flex Rental Solutions deep links.

## Overview

This module provides a type-safe way to build URLs that link to different sections of the Flex Rental Solutions platform.

## Usage

```typescript
import { buildFlexUrl } from '@/lib/flex/urlBuilder';

// Build a simple element link
const url = buildFlexUrl({
  intent: 'simple-element',
  elementId: 'abc123',
});
// Result: https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#element/abc123/view/simple-element/header

// Build a financial document link
const finUrl = buildFlexUrl({
  intent: 'financial-document',
  elementId: 'doc456',
});
// Result: https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop#fin-doc/doc456/doc-view/ca6b072c-b122-11df-b8d5-00e08175e43e/header

// Override the base URL
const customUrl = buildFlexUrl({
  intent: 'simple-element',
  elementId: 'xyz789',
  baseUrl: 'https://custom.flexrentalsolutions.com/f5/ui/?desktop',
});
```

## Available Intents

- `simple-element` - Simple project elements, folders, and subfolders
- `financial-document` - Financial documents (presupuesto, orden, etc.)
- `expense-sheet` - Expense sheets (hoja de gastos)
- `contact-list` - Contact list views
- `remote-file-list` - Remote file list views
- `equipment-list` - Equipment list views

## Configuration

Set the `VITE_FLEX_BASE_URL` environment variable to customize the base URL:

```bash
VITE_FLEX_BASE_URL=https://custom.flexrentalsolutions.com/f5/ui/?desktop
```

If not set, it defaults to `https://sectorpro.flexrentalsolutions.com/f5/ui/?desktop`.

## Exports

- `buildFlexUrl(options)` - Main function to build URLs
- `getFlexBaseUrl()` - Get the configured base URL
- `FLEX_TEMPLATE_IDS` - Constants for template IDs used in URLs
- `FlexLinkIntent` - TypeScript type for available intents
- `BuildFlexUrlOptions` - TypeScript interface for options

## Features

- ✅ Type-safe intent selection
- ✅ Element ID validation
- ✅ Base URL normalization (handles trailing slashes and hashes)
- ✅ No double-encoding of IDs
- ✅ Configurable via environment variables
- ✅ Comprehensive test coverage
