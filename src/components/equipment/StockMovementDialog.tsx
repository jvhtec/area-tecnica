import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Equipment } from "@/types/equipment";
import { notificationService } from "@/services/NotificationService";

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  currentStock?: number;
  isAddition?: boolean;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  equipment,
  currentStock = 0,
  isAddition = true
}: StockMovementDialogProps) {
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState("");
  const { session } = useSessionManager();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stockMovementMutation = useMutation({
    mutationFn: async () => {
      if (!session?.user?.id) throw new Error('Not authenticated');
      
      // Get current stock entry
      const { data: stockEntry } = await supabase
        .from('stock_entries')
        .select('*')
        .eq('equipment_id', equipment.id)
        .maybeSingle();

      // Calculate new base quantity
      const movementQty = Math.abs(quantity);
      const newBaseQty = isAddition ? 
        (stockEntry?.base_quantity || 0) + movementQty :
        (stockEntry?.base_quantity || 0) - movementQty;

      if (!isAddition && newBaseQty < 0) {
        throw new Error('Not enough stock available');
      }

      // Begin transaction
      const { error: stockMovementError } = await supabase
        .from('stock_movements')
        .insert({
          equipment_id: equipment.id,
          quantity: movementQty,
          movement_type: isAddition ? 'addition' : 'subtraction',
          notes: notes.trim() || null,
          user_id: session.user.id
        });

      if (stockMovementError) throw stockMovementError;

      // Update or insert stock entry
      if (stockEntry) {
        const { error: updateError } = await supabase
          .from('stock_entries')
          .update({ base_quantity: newBaseQty })
          .eq('id', stockEntry.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('stock_entries')
          .insert({
            equipment_id: equipment.id,
            base_quantity: newBaseQty
          });

        if (insertError) throw insertError;
      }

      // Send notification
      await notificationService.sendGearMovementNotification(
        equipment.name,
        movementQty,
        isAddition ? 'addition' : 'subtraction'
      );
    },
    onSuccess: () => {
      // Invalidate both queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      toast({
        title: "Success",
        description: `Stock ${isAddition ? 'added' : 'removed'} successfully`
      });
      handleClose();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    stockMovementMutation.mutate();
  };

  const handleClose = () => {
    setQuantity(1);
    setNotes("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isAddition ? "Add" : "Remove"} Stock - {equipment.name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={!isAddition ? currentStock : undefined}
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              required
            />
            {!isAddition && (
              <p className="text-sm text-muted-foreground">
                Current stock: {currentStock}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant notes..."
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={stockMovementMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={stockMovementMutation.isPending || (!isAddition && quantity > currentStock)}
            >
              {stockMovementMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
