import { useState } from 'react';
import { StockEntry, getCategoriesForDepartment } from '@/types/equipment';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { StockCreationManager } from '@/components/disponibilidad/StockCreationManager';
import { AlertCircle, Box } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

/**
 * Renders a dialog that allows the authenticated user to manage inventory for their department.
 *
 * The component fetches department-specific stock entries and displays a stock management UI when data is available; if the user has no associated department it renders `null`. On fetch errors it shows an error alert instead of the manager.
 *
 * @returns The dialog JSX element when the user has a department, otherwise `null`.
 */
export function InventoryManagementDialog() {
    const [open, setOpen] = useState(false);
    const auth = useAuth();
    const { session } = auth;
    const userDepartment = auth.userDepartment;

    // Fetch current stock entries filtered by user department categories
    const { data: stockEntries = [], error: stockError } = useQuery({
        queryKey: ['stock-entries', userDepartment],
        queryFn: async () => {
            if (!session?.user?.id || !userDepartment) return [];

            const categories = getCategoriesForDepartment(userDepartment as any);

            const { data, error } = await supabase
                .from('global_stock_entries')
                .select('*, equipment!inner(category)')
                .in('equipment.category', categories);

            if (error) {
                console.error('Error fetching stock entries:', error);
                throw error;
            }
            return data as StockEntry[];
        },
        enabled: !!session?.user?.id && !!userDepartment && open
    });

    if (!userDepartment) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Box className="mr-2 h-4 w-4" />
                    Gestionar Inventario
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                <DialogHeader className="flex-shrink-0">
                    <DialogTitle>Gestionar Inventario</DialogTitle>
                    <DialogDescription>
                        Administra el equipamiento y cantidades del departamento.
                    </DialogDescription>
                </DialogHeader>

                {stockError ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>
                            Error al cargar el inventario. Por favor, inténtelo de nuevo más tarde.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <div className="flex-1 min-h-0">
                        <StockCreationManager
                            stock={stockEntries}
                            onStockUpdate={() => {}}
                            department={userDepartment}
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}