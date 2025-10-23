import { ReactNode } from 'react';
import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface MobileFilterSheetProps {
  /** The filter content to display in the sheet */
  children: ReactNode;
  /** Number of active filters to display in the badge */
  activeFilterCount?: number;
  /** Callback when filters are reset */
  onReset?: () => void;
  /** Whether the sheet is open (controlled) */
  open?: boolean;
  /** Callback when open state changes (controlled) */
  onOpenChange?: (open: boolean) => void;
  /** Custom trigger button text */
  triggerText?: string;
  /** Custom title for the sheet */
  title?: string;
  /** Custom description for the sheet */
  description?: string;
}

/**
 * Mobile-friendly filter panel using a bottom sheet
 * Provides a condensed way to display filters on mobile devices
 */
export function MobileFilterSheet({
  children,
  activeFilterCount = 0,
  onReset,
  open,
  onOpenChange,
  triggerText = 'Filters',
  title = 'Filter Options',
  description,
}: MobileFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          {triggerText}
          {activeFilterCount > 0 && (
            <Badge 
              variant="default" 
              className="ml-2 h-5 min-w-[20px] rounded-full px-1.5 text-[10px]"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            {title}
          </SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="py-4 space-y-4">
          {children}
        </div>
        <SheetFooter className="flex flex-row gap-2 justify-between">
          {onReset && activeFilterCount > 0 && (
            <Button variant="outline" onClick={onReset} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          )}
          <SheetClose asChild>
            <Button className="flex-1">
              Apply Filters
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
