# Mobile Responsive UI Changes

## Overview

This document summarizes all mobile responsive enhancements made to Sector Pro's UI components. These changes ensure touch-friendly interactions and optimal display on mobile devices while maintaining desktop usability.

## Summary of Changes

### Core UI Components Enhanced

All changes follow a mobile-first responsive pattern using Tailwind's breakpoint system, primarily using `md:` (768px) as the transition point.

#### 1. Card Component (`src/components/ui/card.tsx`)
- **CardHeader/CardContent/CardFooter**: Padding reduced from `p-6` to `p-4` on mobile, `p-6` on desktop
- **CardTitle**: Font size reduced from `text-2xl` to `text-xl` on mobile
- **CardFooter**: Added gap spacing for better button layout

#### 2. Tabs Component (`src/components/ui/tabs.tsx`)
- **TabsList**: Height increased from `h-10` to `h-12` on mobile for better touch targets
- **TabsTrigger**: 
  - Minimum 44px touch target height on mobile
  - Text size: `text-base` on mobile, `text-sm` on desktop
  - Padding: `px-4 py-2` on mobile, `px-3 py-1.5` on desktop

#### 3. Dialog Component (`src/components/ui/dialog.tsx`)
- **DialogContent**:
  - Width: `calc(100% - 2rem)` on mobile (full width with margins)
  - Max height: `90vh` with overflow scroll
  - Padding: `p-4` on mobile, `p-6` on desktop
  - Close button: Larger 32px × 32px on mobile with centered icon

#### 4. Sheet Component (`src/components/ui/sheet.tsx`)
- **SheetContent**:
  - Width: `85%` of screen on mobile, `max-w-sm` on desktop
  - Padding: `p-4` on mobile, `p-6` on desktop
  - Close button: Larger touch target on mobile

#### 5. Button Component (`src/components/ui/button.tsx`)
- **All variants**:
  - Default size: `min-h-[44px]` on mobile, `h-10` on desktop
  - Large size: `min-h-[48px]` on mobile, `h-11` on desktop
  - Icon buttons: `min-h-[44px] min-w-[44px]` on mobile
  - Text: `text-base` on mobile, `text-sm` on desktop

#### 6. Input Component (`src/components/ui/input.tsx`)
- **All inputs**:
  - Height: `min-h-[44px]` on mobile, `h-10` on desktop
  - Text: `text-base` on mobile (prevents zoom), `text-sm` on desktop

#### 7. Select Component (`src/components/ui/select.tsx`)
- **SelectTrigger**:
  - Height: `min-h-[44px]` on mobile, `h-10` on desktop
  - Text: `text-base` on mobile, `text-sm` on desktop
- **SelectItem**:
  - Minimum 44px touch target height on mobile
  - Padding: `py-2` on mobile, `py-1.5` on desktop
  - Text: `text-base` on mobile, `text-sm` on desktop

#### 8. Textarea Component (`src/components/ui/textarea.tsx`)
- **All textareas**:
  - Min height: `100px` on mobile, `80px` on desktop
  - Text: `text-base` on mobile, `text-sm` on desktop

#### 9. Label Component (`src/components/ui/label.tsx`)
- **All labels**:
  - Text: `text-base` on mobile, `text-sm` on desktop

#### 10. Form Components (`src/components/ui/form.tsx`)
- **FormDescription**: Text: `text-sm` on mobile, `text-xs` on desktop
- **FormMessage**: Added `leading-relaxed` for better readability

#### 11. Checkbox Component (`src/components/ui/checkbox.tsx`)
- **Checkbox**:
  - Size: `h-5 w-5` on mobile, `h-4 w-4` on desktop
  - Check icon: `h-5 w-5` on mobile, `h-4 w-4` on desktop

#### 12. Radio Group Component (`src/components/ui/radio-group.tsx`)
- **RadioGroupItem**:
  - Size: `h-5 w-5` on mobile, `h-4 w-4` on desktop
  - Indicator: `h-3 w-3` on mobile, `h-2.5 w-2.5` on desktop

#### 13. Switch Component (`src/components/ui/switch.tsx`)
- **Switch**:
  - Size: `h-7 w-12` on mobile, `h-6 w-11` on desktop
  - Thumb: `h-6 w-6` on mobile, `h-5 w-5` on desktop

#### 14. Table Component (`src/components/ui/table.tsx`)
- **TableHead**: 
  - Padding: `px-3` on mobile, `px-4` on desktop
  - Added `whitespace-nowrap` for better mobile scroll
- **TableCell**: 
  - Padding: `p-3` on mobile, `p-4` on desktop

#### 15. Date-Time Picker (`src/components/ui/date-time-picker.tsx`)
- **Container**: Stacks vertically on mobile (`flex-col`), horizontal on desktop (`md:flex-row`)
- **Inputs**: Full width on mobile, fixed width on desktop

### New Components

#### ResponsiveTable Component (`src/components/shared/ResponsiveTable.tsx`)

A powerful new component that automatically adapts table layouts for mobile devices.

**Features:**
- Displays as traditional table on desktop
- Converts to card stack on mobile
- Configurable breakpoint (sm/md/lg)
- Column priority system for mobile ordering
- Hide specific columns on mobile
- Custom mobile labels
- Touch-friendly card interactions
- Click handlers for rows/cards

**When to Use:**
- Tables with more than 4 columns
- Complex data that's hard to scroll horizontally
- When you want better mobile UX for data display

**When NOT to Use:**
- Simple tables with ≤3 columns
- Desktop-only views
- Spreadsheet-like interfaces requiring inline editing

See `docs/mobile-ui-patterns.md` for usage examples.

## Breaking Changes

**None.** All changes are purely additive and use responsive classes that preserve existing desktop behavior while enhancing mobile experience.

## Touch Target Guidelines

All interactive elements now meet or exceed the recommended minimum touch target sizes:

- **Apple iOS HIG**: 44pt × 44pt
- **Material Design**: 48dp × 48dp  
- **WCAG 2.5.5**: 44px × 44px (Level AAA)

We use a **minimum of 44px** for all touch targets on mobile.

## Typography Guidelines

### Text Sizes
- Mobile: Use `text-base` (16px) for inputs and interactive elements to prevent zoom
- Desktop: Use `text-sm` (14px) for density
- Labels: `text-base` on mobile, `text-sm` on desktop
- Descriptions: `text-sm` on mobile, `text-xs` on desktop

### Why text-base on Mobile?
iOS Safari and Chrome will automatically zoom when focusing on inputs with font-size < 16px. Using `text-base` prevents this unwanted behavior.

## Spacing Guidelines

### Padding
- Mobile: More generous padding for thumb-friendly interactions
- Desktop: Tighter padding for information density

| Element | Mobile | Desktop |
|---------|--------|---------|
| Cards | `p-4` | `p-6` |
| Dialogs | `p-4` | `p-6` |
| Sheets | `p-4` | `p-6` |
| Table Cells | `p-3` | `p-4` |

### Height
All interactive elements use `min-h-[44px]` on mobile to ensure touch targets.

## Testing Checklist

When building new features or updating existing ones:

### Desktop (≥768px)
- [ ] All functionality works as before
- [ ] No visual regressions
- [ ] Proper information density
- [ ] Hover states work

### Mobile (<768px)
- [ ] Touch targets are at least 44px
- [ ] No horizontal scrolling required
- [ ] Text is readable without zoom
- [ ] Forms don't trigger unwanted zoom
- [ ] Buttons and links are easy to tap
- [ ] Adequate spacing between interactive elements
- [ ] Content fits in viewport

### Test Devices/Sizes
- **Mobile**: 375px (iPhone SE), 390px (iPhone 12/13), 414px (iPhone Plus)
- **Tablet**: 768px (iPad portrait)
- **Desktop**: 1024px+

## Developer Guidelines

### Using Responsive Classes

Always follow this pattern for mobile-first responsive design:

```tsx
// ✅ Correct: Mobile first, desktop override
className="text-base md:text-sm"
className="p-4 md:p-6"
className="min-h-[44px] md:h-10"

// ❌ Wrong: Desktop first (will break mobile)
className="text-sm md:text-base"
className="h-10 md:min-h-[44px]"
```

### Component Usage

```tsx
// ✅ Components are responsive by default
<Button>Click Me</Button>
<Input placeholder="Enter text" />
<Select>...</Select>

// ✅ Use ResponsiveTable for complex tables
<ResponsiveTable
  data={data}
  columns={columns}
  keyExtractor={(item) => item.id}
/>

// ✅ Stack layouts on mobile
<div className="flex flex-col md:flex-row gap-4">
  <Input />
  <Button>Submit</Button>
</div>
```

## Migration Guide

### Existing Code
No changes required for existing code. All components are backward compatible.

### New Features
When building new features:

1. Use the enhanced components as-is (they're responsive by default)
2. For complex tables, consider using `ResponsiveTable`
3. Test on mobile devices early in development
4. Follow the touch target and typography guidelines

### Retrofitting Existing Tables

See `docs/responsive-table-migration-example.md` for detailed examples of migrating existing tables to use ResponsiveTable.

## Documentation

- **Full Guide**: `docs/mobile-ui-patterns.md`
- **ResponsiveTable**: `src/components/shared/ResponsiveTable.md`
- **Migration Example**: `docs/responsive-table-migration-example.md`

## Resources

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Touch Targets](https://material.io/design/usability/accessibility.html)
- [WCAG 2.5.5 Target Size](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)

## Questions or Issues?

If you encounter any issues with mobile responsiveness:

1. Check this document for guidelines
2. Review the component documentation
3. Test on actual devices (not just browser resize)
4. Ensure you're using the `md:` breakpoint correctly

## Future Enhancements

Potential future improvements:
- Additional breakpoint variants (xl, 2xl) for very large screens
- Dark mode optimizations for mobile
- Reduced motion preferences
- Landscape tablet specific optimizations
