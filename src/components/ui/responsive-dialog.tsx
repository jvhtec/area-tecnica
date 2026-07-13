import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type ResponsiveDialogContextValue = {
  dismissible: boolean;
  isMobile: boolean;
};

const ResponsiveDialogContext = React.createContext<ResponsiveDialogContextValue | null>(null);

const useResponsiveDialogContext = () => {
  const context = React.useContext(ResponsiveDialogContext);
  if (!context) {
    throw new Error("ResponsiveDialog components must be used inside ResponsiveDialog");
  }
  return context;
};

export interface ResponsiveDialogProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  modal?: boolean;
  dismissible?: boolean;
}

const ResponsiveDialog = ({
  children,
  open,
  defaultOpen,
  onOpenChange,
  modal = true,
  dismissible = true,
}: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();
  const context = React.useMemo(() => ({ dismissible, isMobile }), [dismissible, isMobile]);

  return (
    <ResponsiveDialogContext.Provider value={context}>
      <Dialog
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={onOpenChange}
        modal={modal}
      >
        {children}
      </Dialog>
    </ResponsiveDialogContext.Provider>
  );
};

const ResponsiveDialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogTrigger>,
  React.ComponentPropsWithoutRef<typeof DialogTrigger>
>((props, ref) => {
  useResponsiveDialogContext();
  return <DialogTrigger ref={ref} {...props} />;
});
ResponsiveDialogTrigger.displayName = "ResponsiveDialogTrigger";

const ResponsiveDialogClose = React.forwardRef<
  React.ElementRef<typeof DialogClose>,
  React.ComponentPropsWithoutRef<typeof DialogClose>
>((props, ref) => {
  useResponsiveDialogContext();
  return <DialogClose ref={ref} {...props} />;
});
ResponsiveDialogClose.displayName = "ResponsiveDialogClose";

interface ResponsiveDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogContent> {
  showCloseButton?: boolean;
}

const ResponsiveDialogContent = React.forwardRef<HTMLDivElement, ResponsiveDialogContentProps>(
  ({ children, className, showCloseButton = true, ...props }, ref) => {
    const { dismissible, isMobile } = useResponsiveDialogContext();

    if (!isMobile) {
      return (
        <DialogContent
          ref={ref}
          data-responsive-mode="desktop"
          className={className}
          {...props}
        >
          {children}
        </DialogContent>
      );
    }

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          data-responsive-mode="mobile"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] w-full max-w-full flex-col overflow-hidden rounded-t-2xl border bg-background pb-[max(0px,env(safe-area-inset-bottom))] shadow-lg duration-300",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            className,
            "max-h-[90dvh] w-full max-w-full overflow-hidden",
          )}
          {...props}
          onEscapeKeyDown={(event) => {
            props.onEscapeKeyDown?.(event);
            if (!dismissible) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            props.onPointerDownOutside?.(event);
            if (!dismissible) event.preventDefault();
          }}
        >
          <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-muted" />
          {showCloseButton && (
            <DialogClose asChild>
              <button
                type="button"
                className="absolute right-4 top-4 z-10 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Cerrar</span>
              </button>
            </DialogClose>
          )}
          <div
            data-responsive-scroll-container
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto overscroll-contain"
          >
            {children}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    );
  },
);
ResponsiveDialogContent.displayName = "ResponsiveDialogContent";

const ResponsiveDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  useResponsiveDialogContext();
  return <DialogHeader className={className} {...props} />;
};
ResponsiveDialogHeader.displayName = "ResponsiveDialogHeader";

const ResponsiveDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  useResponsiveDialogContext();
  return <DialogFooter className={className} {...props} />;
};
ResponsiveDialogFooter.displayName = "ResponsiveDialogFooter";

const ResponsiveDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogTitle>,
  React.ComponentPropsWithoutRef<typeof DialogTitle>
>((props, ref) => {
  useResponsiveDialogContext();
  return <DialogTitle ref={ref} {...props} />;
});
ResponsiveDialogTitle.displayName = "ResponsiveDialogTitle";

const ResponsiveDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogDescription>,
  React.ComponentPropsWithoutRef<typeof DialogDescription>
>((props, ref) => {
  useResponsiveDialogContext();
  return <DialogDescription ref={ref} {...props} />;
});
ResponsiveDialogDescription.displayName = "ResponsiveDialogDescription";

export {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
};
