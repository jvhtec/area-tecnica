import { Suspense, lazy } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const CorporateEmailComposer = lazy(() =>
  import("@/components/emails/CorporateEmailComposer").then((m) => ({ default: m.CorporateEmailComposer }))
);

interface EmailComposerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EmailComposerDialog = ({ open, onOpenChange }: EmailComposerDialogProps) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0f1219] border-[#1f232e] text-slate-100">
                <DialogHeader>
                    <DialogTitle>Redactar Email Corporativo</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                    {open ? (
                      <Suspense fallback={<div className="py-8 text-center text-sm text-muted-foreground">Cargando editor…</div>}>
                        <CorporateEmailComposer />
                      </Suspense>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
};
