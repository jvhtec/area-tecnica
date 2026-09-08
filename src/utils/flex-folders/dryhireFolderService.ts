import { supabase } from "@/integrations/supabase/client";

type DryhireDepartment = "sound" | "lights";

interface YearFolderStatus {
  year: number;
  sound: number;
  lights: number;
}

/**
 * Get the status of dryhire folders for all years
 */
export async function getDryhireYearStatuses(): Promise<YearFolderStatus[]> {
  const { data, error } = await supabase
    .from("dryhire_parent_folders")
    .select("year, department")
    .order("year", { ascending: true });

  if (error) {
    console.error("Error fetching dryhire folder statuses:", error);
    throw new Error("Failed to fetch dryhire folder statuses");
  }

  // Group by year and count per department
  const yearMap = new Map<number, { sound: number; lights: number }>();

  for (const row of data || []) {
    if (!yearMap.has(row.year)) {
      yearMap.set(row.year, { sound: 0, lights: 0 });
    }
    const counts = yearMap.get(row.year)!;
    if (row.department === "sound") counts.sound++;
    if (row.department === "lights") counts.lights++;
  }

  return Array.from(yearMap.entries()).map(([year, counts]) => ({
    year,
    ...counts,
  }));
}

/**
 * Get the parent folder ID for a dryhire job
 */
export async function getDryhireParentFolderId(
  year: number,
  department: DryhireDepartment,
  month: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("dryhire_parent_folders")
    .select("element_id")
    .eq("year", year)
    .eq("department", department)
    .eq("month", month)
    .single();

  if (error) {
    console.error("Error fetching dryhire parent folder:", error);
    return null;
  }

  return data?.element_id || null;
}

/**
 * Create all dryhire folders for a given year
 */
export async function createDryhireYearFolders(year: number): Promise<void> {
  if (!Number.isInteger(year) || year < 2000 || year > 2200) {
    throw new Error("Año de dry hire no válido");
  }
  const { data, error } = await supabase.functions.invoke("create-flex-folders", {
    body: { operation: "dryhire-year", year },
  });
  if (error) throw error;
  const result = data as { success?: boolean; error?: string; status?: string } | null;
  if (result?.success === false) {
    throw new Error(result.error || `La creación de ${year} requiere reconciliación (${result.status || "partial"})`);
  }
}
