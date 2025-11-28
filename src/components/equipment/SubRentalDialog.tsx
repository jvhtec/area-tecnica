import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { SubRentalManager } from "@/components/equipment/SubRentalManager";
import { PackagePlus } from "lucide-react";
import { useState } from "react";

export function SubRentalDialog() {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="w-full justify-start border-dashed border-purple-500/50 hover:border-purple-500 hover:bg-purple-500/10 text-purple-400">
                    <PackagePlus className="mr-2 h-4 w-4" />
                    Manage Sub-Rentals
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Sub-Rental Management</DialogTitle>
                    <DialogDescription>
                        Manage temporary stock boosts and sub-rentals.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <SubRentalManager />
                </div>
            </DialogContent>
        </Dialog>
    );
}
