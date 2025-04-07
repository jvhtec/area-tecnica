
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { 
  createBatterySalesQuote, 
  addBatteryLineItem, 
  confirmQuoteAndCreatePullSheet 
} from "@/services/batterySalesService";
import { BATTERY_TYPE_NAMES } from "@/utils/flex-folders/battery-constants";

export function useBatterySales(tourDateId: string | null) {
  const [loading, setLoading] = useState(false);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const createQuote = useCallback(async () => {
    if (!tourDateId) {
      toast.error("No tour date selected");
      return null;
    }

    try {
      setLoading(true);
      const quote = await createBatterySalesQuote(tourDateId);
      setQuoteId(quote.id);
      return quote;
    } catch (error) {
      console.error("Error creating battery sales quote:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tourDateId]);

  const addBatteryToQuote = useCallback(async (
    batteryQuoteId: string,
    batteryType: keyof typeof BATTERY_TYPE_NAMES,
    quantity: number
  ) => {
    try {
      setLoading(true);
      const updatedQuote = await addBatteryLineItem(
        batteryQuoteId,
        batteryType,
        quantity
      );
      toast.success(`Added ${quantity} ${BATTERY_TYPE_NAMES[batteryType]} to quote`);
      return updatedQuote;
    } catch (error) {
      console.error("Error adding battery to quote:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmQuote = useCallback(async (batteryQuoteId: string) => {
    try {
      setLoading(true);
      const confirmedQuote = await confirmQuoteAndCreatePullSheet(batteryQuoteId);
      // Invalidate any relevant queries
      queryClient.invalidateQueries({
        queryKey: ["battery-sales", tourDateId]
      });
      return confirmedQuote;
    } catch (error) {
      console.error("Error confirming battery sales quote:", error);
      return null;
    } finally {
      setLoading(false);
    }
  }, [tourDateId, queryClient]);

  return {
    loading,
    quoteId,
    setQuoteId,
    createQuote,
    addBatteryToQuote,
    confirmQuote
  };
}
