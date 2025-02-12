
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

interface StockMovementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipment: Equipment;
  isAddition?: boolean;
}

export function StockMovementDialog({
  open,
  onOpenChange,
  equipment,
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
      
      const { error } = await supabase
        .from('stock_movements')
        .insert({
          equipment_id: equipment.id,
          user_id: session.user.id,
          quantity: isAddition ? quantity : -quantity,
          movement_type: isAddition ? 'addition' : 'subtraction',
          notes: notes.trim() || null
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['current-stock-levels'] });
      queryClient.invalidateQueries({ queryKey: ['stock-entries'] });
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
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              required
            />
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
              disabled={stockMovementMutation.isPending}
            >
              {stockMovementMutation.isPending ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
