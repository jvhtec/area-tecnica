import { supabase } from "@/lib/supabase";
import { fetchJobLogo, fetchLogoUrl } from "@/utils/pdf/logoUtils";

export const loadFestivalStageMetadata = async (jobId: string) => {
  const logoUrl = (await fetchJobLogo(jobId)) || (await fetchLogoUrl(jobId));
  const { data: stageNames, error } = await supabase
    .from("festival_stages")
    .select("number, name")
    .eq("job_id", jobId)
    .order("number");
  if (error) console.error("Error fetching stage names:", error);

  const getStageNameByNumber = (stageNumber: number): string =>
    stageNames?.find((stage) => stage.number === stageNumber)?.name || `Stage ${stageNumber}`;
  const stageNamesByNumber = (stageNames || []).reduce<Record<number, string>>((names, stage) => {
    names[Number(stage.number)] = stage.name || `Escenario ${stage.number}`;
    return names;
  }, {});

  return { getStageNameByNumber, logoUrl, stageNamesByNumber };
};

export const loadStagePlotUrls = async (
  artists: Array<{ id: string; stage_plot_file_path?: string | null }>,
): Promise<Record<string, string>> => {
  const urls: Record<string, string> = {};
  await Promise.all(artists.filter((artist) => Boolean(artist.stage_plot_file_path)).map(async (artist) => {
    try {
      const { data, error } = await supabase.storage
        .from("festival_artist_files")
        .createSignedUrl(String(artist.stage_plot_file_path), 60 * 60);
      if (!error && data?.signedUrl) urls[String(artist.id)] = data.signedUrl;
    } catch (error) {
      console.error(`Error signing stage plot for artist ${artist.id}:`, error);
    }
  }));
  return urls;
};
