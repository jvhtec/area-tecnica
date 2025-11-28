import { useState } from 'react';
import { StockEntry, getCategoriesForDepartment } from '@/types/equipment';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useOptimizedAuth } from '@/hooks/useOptimizedAuth';
import { useToast } from '@/hooks/use-toast';
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

export function InventoryManagementDialog() {
    const [open, setOpen] = useState(false);
    const auth = useOptimizedAuth();
    const { session } = auth;
    const userDepartment = auth.userDepartment;
    const queryClient = useQueryClient();
    const { toast } = useToast();

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

    // Update stock entries mutation with correct table name
    const updateStockMutation = useMutation({
        mutationFn: async (updatedStock: StockEntry[]) => {
            if (!session?.user?.id) throw new Error('No user session');

            // Process each stock entry individually
            for (const entry of updatedStock) {
                const { error: upsertError } = await supabase
                    .from('global_stock_entries')
                    .upsert({
                        id: entry.id,
                        equipment_id: entry.equipment_id,
                        base_quantity: entry.base_quantity
                    });

                if (upsertError) {
                    console.error('Error updating stock entry:', upsertError);
                    throw upsertError;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-entries'] });
            queryClient.invalidateQueries({ queryKey: ['current-stock-levels'] });
            toast({
                title: "Éxito",
                description: "Inventario actualizado correctamente"
            });
            setOpen(false);
        },
        onError: (error) => {
            console.error('Error in updateStockMutation:', error);
            toast({
                variant: "destructive",
                title: "Error",
                description: "Error al actualizar el inventario"
            });
        }
    });

    const handleStockUpdate = (updatedStock: StockEntry[]) => {
        updateStockMutation.mutate(updatedStock);
    };

    if (!userDepartment) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                    <Box className="mr-2 h-4 w-4" />
                    Gestionar Inventario
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Gestionar Inventario</DialogTitle>
                    <DialogDescription>
                        Administra el stock base y el equipamiento del departamento.
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
                    <StockCreationManager
                        stock={stockEntries}
                        onStockUpdate={handleStockUpdate}
                        department={userDepartment}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
