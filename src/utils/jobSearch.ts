/** Accent- and case-insensitive text for job search ("José" matches "jose"). */
export const normalizeJobSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

export const buildJobSearchTokens = (query: string) =>
  normalizeJobSearchText(query).split(/\s+/).filter(Boolean);

type JobSearchLocation = { name?: string | null; formatted_address?: string | null };

export type JobSearchFields = {
  title?: string | null;
  /** PostgREST embeds can arrive as an object or a one-element array. */
  location?: JobSearchLocation | JobSearchLocation[] | null;
};

/** Every token must appear in the title, the location name or the location address. */
export const matchesJobSearch = (job: JobSearchFields, tokens: string[]) => {
  if (tokens.length === 0) return true;
  const location = Array.isArray(job.location) ? job.location[0] : job.location;
  const searchableValues = [job.title, location?.name, location?.formatted_address]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map(normalizeJobSearchText);
  return tokens.every((token) => searchableValues.some((value) => value.includes(token)));
};
