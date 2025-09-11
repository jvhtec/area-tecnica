import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Equipment } from "@/types/equipment";

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
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStockMovement = async () => {
    if (!session?.user?.id) {
      toast({
        variant: "destructive",
        title: "Error", 
        description: "Not authenticated"
      });
      return;
    }

    try {
      // Get current stock entry from global_stock_entries
      const { data: stockEntry } = await supabase
        .from('global_stock_entries')
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

      // Update or insert stock entry
      if (stockEntry) {
        const { error: updateError } = await supabase
          .from('global_stock_entries')
          .update({ base_quantity: newBaseQty })
          .eq('id', stockEntry.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('global_stock_entries')
          .insert({
            equipment_id: equipment.id,
            base_quantity: newBaseQty
          });

        if (insertError) throw insertError;
      }

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels'] });
      toast({
        title: "Success",
        description: `Stock ${isAddition ? 'added' : 'removed'} successfully`
      });
      handleClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleStockMovement();
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
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={(!isAddition && quantity > currentStock)}
            >
              Confirm
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
