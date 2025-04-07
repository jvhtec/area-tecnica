
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Battery, Check, Plus, Loader2 } from "lucide-react";
import { useBatterySales } from "@/hooks/battery/useBatterySales";
import { BATTERY_TYPE_NAMES } from "@/utils/flex-folders/battery-constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

interface BatterySalesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourDateId: string | null;
}

export const BatterySalesDialog: React.FC<BatterySalesDialogProps> = ({
  open,
  onOpenChange,
  tourDateId,
}) => {
  const [quote, setQuote] = useState<any | null>(null);
  const [selectedBatteryType, setSelectedBatteryType] = useState<keyof typeof BATTERY_TYPE_NAMES>("pilaAA");
  const [quantity, setQuantity] = useState("10");
  const [initialLoading, setInitialLoading] = useState(true);

  const {
    loading,
    quoteId,
    setQuoteId,
    createQuote,
    addBatteryToQuote,
    confirmQuote,
  } = useBatterySales(tourDateId);

  // Fetch existing quote for this tour date if available
  useEffect(() => {
    const fetchExistingQuote = async () => {
      if (!tourDateId || !open) return;
      setInitialLoading(true);

      try {
        const { data, error } = await supabase
          .from("battery_sales_quotes")
          .select("*")
          .eq("tour_date_id", tourDateId)
          .eq("status", "draft")
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setQuote(data);
          setQuoteId(data.id);
        } else {
          // No existing quote, create a new one
          const newQuote = await createQuote();
          if (newQuote) {
            setQuote(newQuote);
          }
        }
      } catch (error) {
        console.error("Error fetching existing battery sales quote:", error);
        toast.error("Error loading battery sales information");
      } finally {
        setInitialLoading(false);
      }
    };

    fetchExistingQuote();
  }, [tourDateId, open, createQuote, setQuoteId]);

  const handleAddBattery = async () => {
    if (!quoteId) return;

    const numQuantity = parseInt(quantity, 10);
    if (isNaN(numQuantity) || numQuantity <= 0) {
      toast.error("Please enter a valid quantity");
      return;
    }

    const updatedQuote = await addBatteryToQuote(
      quoteId,
      selectedBatteryType,
      numQuantity
    );

    if (updatedQuote) {
      setQuote(updatedQuote);
      setQuantity("10"); // Reset quantity
    }
  };

  const handleConfirmQuote = async () => {
    if (!quoteId) return;

    if (!quote.batteries || quote.batteries.length === 0) {
      toast.error("Please add at least one battery to the quote");
      return;
    }

    const confirmedQuote = await confirmQuote(quoteId);
    if (confirmedQuote) {
      setQuote(confirmedQuote);
      toast.success("Battery sales quote confirmed successfully");
      setTimeout(() => onOpenChange(false), 1500);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Battery className="h-5 w-5" />
            Battery Sales Quote
          </DialogTitle>
        </DialogHeader>

        {initialLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {quote?.status === "confirmed" ? (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md flex items-center gap-2 text-green-600 dark:text-green-400">
                  <Check className="h-5 w-5" />
                  <span>Battery sales quote confirmed</span>
                </div>
              ) : (
                <>
                  <div>
                    <Label htmlFor="batteryType">Battery Type</Label>
                    <select
                      id="batteryType"
                      className="w-full border rounded-md p-2 mt-1"
                      value={selectedBatteryType}
                      onChange={(e) => setSelectedBatteryType(e.target.value as keyof typeof BATTERY_TYPE_NAMES)}
                      disabled={loading}
                    >
                      {Object.entries(BATTERY_TYPE_NAMES).map(([key, name]) => (
                        <option key={key} value={key}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <Button
                    onClick={handleAddBattery}
                    disabled={loading || !quoteId}
                    className="w-full"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Add Battery
                  </Button>
                </>
              )}

              {/* Battery List */}
              {quote?.batteries && quote.batteries.length > 0 && (
                <div className="mt-6 border rounded-md overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="py-2 px-4 text-left">Type</th>
                        <th className="py-2 px-4 text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quote.batteries.map((battery: any, index: number) => (
                        <tr key={index} className="border-t">
                          <td className="py-2 px-4">
                            {BATTERY_TYPE_NAMES[battery.type as keyof typeof BATTERY_TYPE_NAMES] || battery.type}
                          </td>
                          <td className="py-2 px-4 text-right">{battery.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <DialogFooter>
              {quote?.status !== "confirmed" && (
                <Button
                  onClick={handleConfirmQuote}
                  disabled={loading || !quoteId || !quote?.batteries || quote.batteries.length === 0}
                  className="mt-4"
                  variant="default"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Confirm Quote
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
