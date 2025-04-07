
import { ApiService } from "@/lib/api-service";
import { FLEX_API_BASE_URL } from "@/lib/api-config";
import { FLEX_BATTERY_IDS } from "@/utils/flex-folders/battery-constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export interface BatteryQuoteRequest {
  tourDateId: string;
  parentElementId?: string; // Optional parent element ID, if different from default
  batteryType: keyof typeof FLEX_BATTERY_IDS.batteryTypes;
  quantity: number;
}

export interface BatterySalesQuote {
  id: string;
  elementId: string;
  documentNumber: string;
  createdAt: string;
  status: string;
  tourDateId: string;
  batteries: {
    type: string;
    quantity: number;
    lineItemId: string;
  }[];
}

/**
 * Creates a new battery sales quote in the Flex system
 */
export async function createBatterySalesQuote(tourDateId: string): Promise<BatterySalesQuote> {
  try {
    // First check if a quote already exists for this tour date
    const { data: existingQuotes, error: checkError } = await supabase
      .from("battery_sales_quotes")
      .select("*")
      .eq("tour_date_id", tourDateId)
      .eq("status", "draft");
    
    if (checkError) throw checkError;
    
    // If a draft quote exists, return it
    if (existingQuotes && existingQuotes.length > 0) {
      console.log("Found existing battery sales quote:", existingQuotes[0]);
      return existingQuotes[0];
    }
    
    // Get tour date info
    const { data: tourDate, error: tourDateError } = await supabase
      .from("tour_dates")
      .select(`
        id,
        date,
        tour_id,
        location:locations (name),
        tours (name)
      `)
      .eq("id", tourDateId)
      .single();
      
    if (tourDateError) throw tourDateError;
    
    const tourName = tourDate.tours.name;
    const locationName = tourDate.location?.name || "No Location";
    const dateString = new Date(tourDate.date).toISOString().split('T')[0];
    
    // Create quote in Flex
    const apiService = ApiService.getInstance();
    
    const quotePayload = {
      definitionId: FLEX_BATTERY_IDS.salesQuoteElementId,
      parentElementId: null, // Will use default parent
      open: true,
      locked: false,
      name: `Baterías - ${tourName} - ${locationName} - ${dateString}`,
      documentNumber: `BAT-${dateString.replace(/-/g, '')}`
    };
    
    console.log("Creating battery sales quote with payload:", quotePayload);
    
    const quoteResponse = await apiService.post(
      `${FLEX_API_BASE_URL}/element`,
      quotePayload
    );
    
    console.log("Created battery sales quote:", quoteResponse);
    
    // Store in our database
    const { data: newQuote, error: insertError } = await supabase
      .from("battery_sales_quotes")
      .insert({
        tour_date_id: tourDateId,
        element_id: quoteResponse.elementId,
        document_number: quoteResponse.documentNumber || quotePayload.documentNumber,
        status: "draft",
        batteries: []
      })
      .select()
      .single();
      
    if (insertError) throw insertError;
    
    return {
      id: newQuote.id,
      elementId: newQuote.element_id,
      documentNumber: newQuote.document_number,
      createdAt: newQuote.created_at,
      status: newQuote.status,
      tourDateId: newQuote.tour_date_id,
      batteries: newQuote.batteries || []
    };
  } catch (error) {
    console.error("Error creating battery sales quote:", error);
    toast.error("Error creating battery sales quote");
    throw error;
  }
}

/**
 * Adds a battery line item to an existing quote
 */
export async function addBatteryLineItem(
  quoteId: string, 
  batteryType: keyof typeof FLEX_BATTERY_IDS.batteryTypes,
  quantity: number
): Promise<BatterySalesQuote> {
  try {
    // Get current quote information
    const { data: quote, error: quoteError } = await supabase
      .from("battery_sales_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();
      
    if (quoteError) throw quoteError;
    
    const apiService = ApiService.getInstance();
    const resourceId = FLEX_BATTERY_IDS.batteryTypes[batteryType];
    
    // Add line item to the quote
    const url = `${FLEX_API_BASE_URL}/financial-document-line-item/${quote.element_id}/add-resource/${resourceId}?quantity=${quantity}`;
    console.log(`Adding battery line item: ${url}`);
    
    const lineItemResponse = await apiService.post(url, {});
    console.log("Added battery line item:", lineItemResponse);
    
    // Update the batteries array in our database
    const batteries = [...(quote.batteries || [])];
    const existingIndex = batteries.findIndex(b => b.type === batteryType);
    
    if (existingIndex >= 0) {
      // Update existing entry
      batteries[existingIndex].quantity += quantity;
      batteries[existingIndex].lineItemId = lineItemResponse.addedResourceLineIds[0];
    } else {
      // Add new entry
      batteries.push({
        type: batteryType,
        quantity,
        lineItemId: lineItemResponse.addedResourceLineIds[0]
      });
    }
    
    // Update the database
    const { data: updatedQuote, error: updateError } = await supabase
      .from("battery_sales_quotes")
      .update({ batteries })
      .eq("id", quoteId)
      .select()
      .single();
      
    if (updateError) throw updateError;
    
    return {
      id: updatedQuote.id,
      elementId: updatedQuote.element_id,
      documentNumber: updatedQuote.document_number,
      createdAt: updatedQuote.created_at,
      status: updatedQuote.status,
      tourDateId: updatedQuote.tour_date_id,
      batteries: updatedQuote.batteries
    };
  } catch (error) {
    console.error("Error adding battery line item:", error);
    toast.error("Error adding battery to quote");
    throw error;
  }
}

/**
 * Confirms a quote and updates its status
 */
export async function confirmQuoteAndCreatePullSheet(quoteId: string): Promise<BatterySalesQuote> {
  try {
    // Get current quote information
    const { data: quote, error: quoteError } = await supabase
      .from("battery_sales_quotes")
      .select("*")
      .eq("id", quoteId)
      .single();
      
    if (quoteError) throw quoteError;
    
    if (quote.status !== "draft") {
      throw new Error("Can only confirm draft quotes");
    }
    
    // No need to update Flex status - we're just tracking internally
    
    // Update the database
    const { data: updatedQuote, error: updateError } = await supabase
      .from("battery_sales_quotes")
      .update({ status: "confirmed" })
      .eq("id", quoteId)
      .select()
      .single();
      
    if (updateError) throw updateError;
    
    toast.success("Battery sales quote confirmed");
    
    return {
      id: updatedQuote.id,
      elementId: updatedQuote.element_id,
      documentNumber: updatedQuote.document_number,
      createdAt: updatedQuote.created_at,
      status: updatedQuote.status,
      tourDateId: updatedQuote.tour_date_id,
      batteries: updatedQuote.batteries
    };
  } catch (error) {
    console.error("Error confirming battery sales quote:", error);
    toast.error("Error confirming battery sales quote");
    throw error;
  }
}
