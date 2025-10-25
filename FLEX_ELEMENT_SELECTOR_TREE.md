# Flex Element Selector Dialog - Tree Implementation

## Overview
This document describes the tree-based Flex Element Selector Dialog implementation, which provides a hierarchical, searchable interface for selecting Flex elements.

## Components

### FlexElementSelectorDialog
**Location**: `src/components/flex/FlexElementSelectorDialog.tsx`

A reusable React component that displays a dialog with a searchable tree of Flex elements.

#### Features
- **Hierarchical Display**: Shows elements in a nested tree structure with visual indentation
- **Search/Filter**: Real-time filtering by element name or document number (case-insensitive)
- **Loading States**: Displays spinner while fetching data
- **Error Handling**: Shows error message with retry button on failure
- **Default Highlighting**: Highlights and labels the default element when specified
- **Responsive**: Scrollable list for large trees (max-height: 400px)
- **Command Menu UI**: Uses shadcn-ui Command component for smooth UX

#### Props
```typescript
interface FlexElementSelectorDialogProps {
  open: boolean;                    // Controls dialog visibility
  onOpenChange: (open: boolean) => void;  // Dialog state change callback
  mainElementId: string;            // Root element ID to fetch tree from
  defaultElementId?: string;        // Optional element to highlight as default
  onSelect: (elementId: string) => void;  // Called when element is selected
}
```

#### Usage Example
```typescript
import { FlexElementSelectorDialog } from "@/components/flex/FlexElementSelectorDialog";

function MyComponent() {
  const [open, setOpen] = useState(false);
  
  const handleSelect = (elementId: string) => {
    console.log("Selected:", elementId);
    // Open in Flex, save to state, etc.
  };
  
  return (
    <FlexElementSelectorDialog
      open={open}
      onOpenChange={setOpen}
      mainElementId="main-element-123"
      defaultElementId="child-element-456"
      onSelect={handleSelect}
    />
  );
}
```

## Utilities

### getElementTree
**Location**: `src/utils/flex-folders/getElementTree.ts`

Core utilities for fetching and processing Flex element trees.

#### Functions

##### `getElementTree(mainElementId: string): Promise<FlexElementNode[]>`
Fetches the complete element tree from the Flex API.

**Returns**: Array of FlexElementNode objects with hierarchical structure
**Throws**: Error if API call fails

##### `flattenTree(nodes: FlexElementNode[], depth?: number): FlatElementNode[]`
Flattens a hierarchical tree into a list with depth information for rendering.

**Parameters**:
- `nodes`: Tree nodes to flatten
- `depth`: Starting depth (default: 0)

**Returns**: Array of FlatElementNode with depth property

##### `searchTree(nodes: FlexElementNode[], query: string): FlatElementNode[]`
Searches tree by display name or document number, returns flattened results.

**Parameters**:
- `nodes`: Tree nodes to search
- `query`: Search query string

**Returns**: Filtered and flattened nodes matching the query

#### Type Definitions

```typescript
interface FlexElementNode {
  elementId: string;
  displayName: string;
  documentNumber?: string;
  parentElementId?: string | null;
  children?: FlexElementNode[];
}

interface FlatElementNode {
  elementId: string;
  displayName: string;
  documentNumber?: string;
  parentElementId?: string | null;
  depth: number;  // For indentation rendering
}
```

## Implementation Details

### Data Fetching
- Uses **TanStack Query** (`@tanstack/react-query`) for data fetching
- Query key: `["flexElementTree", mainElementId]`
- Cache time: 5 minutes (staleTime)
- Retry: 1 attempt on failure
- Only fetches when dialog is open and mainElementId is provided

### Tree Rendering
- Nested elements are indented by `depth * 16px`
- Root elements (depth 0) show a `FolderTree` icon
- Child elements show a `FileText` icon
- Document numbers displayed as secondary text below element name
- Default element highlighted with `bg-accent/50` and "(default)" label

### Search Functionality
- Filters in real-time as user types
- Searches both `displayName` and `documentNumber` fields
- Case-insensitive matching
- Empty search shows all nodes
- Search preserves tree depth for context

### Error Handling
- API errors displayed with error message
- "Retry" button to refetch data
- Loading state shows spinner with text
- Empty state shows appropriate message

## Testing

### Unit Tests

#### `getElementTree.test.ts`
Tests for tree utilities (17 tests):
- ✅ Single-level tree flattening
- ✅ Multi-level tree with correct depth
- ✅ Empty tree handling
- ✅ Property preservation
- ✅ Search by display name
- ✅ Search by document number
- ✅ Case-insensitive search
- ✅ Partial match filtering
- ✅ Deep nesting (multiple levels)
- ✅ Multiple siblings at different depths

#### `FlexElementSelectorDialog.test.tsx`
Component behavior tests (14 tests):
- ✅ Indentation depth calculation
- ✅ Search/filter functionality
- ✅ Node selection callback behavior
- ✅ Default element highlighting
- ✅ Document number display
- ✅ Metadata preservation

### Running Tests
```bash
npm test
```

All tests passing ✅

## Files Created/Modified

### New Files
1. `src/utils/flex-folders/getElementTree.ts` - Element tree utilities
2. `src/utils/flex-folders/getElementTree.test.ts` - Unit tests for utilities
3. `src/components/flex/FlexElementSelectorDialog.test.tsx` - Component tests
4. `src/components/flex/FlexElementSelectorDialog.example.tsx` - Usage examples
5. `FLEX_ELEMENT_SELECTOR_TREE.md` - This documentation

### Modified Files
1. `src/components/flex/FlexElementSelectorDialog.tsx` - Rewritten with tree support
2. `src/utils/flex-folders/index.ts` - Added export for getElementTree
3. `docs/flex-folder-workflows.md` - Updated documentation

## Integration Notes

### API Endpoint
The component expects a Flex API endpoint at:
```
GET https://sectorpro.flexrentalsolutions.com/f5/api/element/{elementId}/tree
```

### Authentication
Uses the same X-Auth-Token as other Flex API calls (see `src/utils/flex-folders/api.ts`)

### Dependencies
- React 18+
- @tanstack/react-query ^5.56.2
- shadcn-ui components (Dialog, Command, Button)
- lucide-react icons

## Future Enhancements

Potential improvements for future iterations:
- [ ] Keyboard navigation (arrow keys to navigate tree)
- [ ] Expand/collapse for large trees
- [ ] Virtualization for very large trees (thousands of nodes)
- [ ] Recent selections history
- [ ] Favorite/pinned elements
- [ ] Breadcrumb navigation for selected element
- [ ] Drag-and-drop support
- [ ] Bulk selection mode
- [ ] Export tree structure
- [ ] Tree visualization diagram

## Performance Considerations

- Query caching prevents redundant API calls (5-minute stale time)
- Tree flattening is memoized via `useMemo`
- Search is optimized with early returns for empty queries
- Command component provides built-in virtualization for long lists

## Accessibility

- Dialog is keyboard accessible (ESC to close)
- Command menu supports keyboard navigation
- Proper ARIA labels on dialog
- Focus management handled by Radix UI primitives

## Browser Support

Supports all modern browsers:
- Chrome/Edge (last 2 versions)
- Firefox (last 2 versions)
- Safari (last 2 versions)

## License

Same as parent project.
