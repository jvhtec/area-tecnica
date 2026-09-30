import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate } from "react-router-dom";

import {
  fetchBlankFormContext,
  fetchJobStageNames,
  fetchPublicArtistFormContext,
  resolveFestivalLogoUrl,
} from "@/features/festival-forms/api";
import {
  artistToFormState,
  computeLockedFields,
  parseRiderFiles,
  stageNameMap,
} from "@/features/festival-forms/publicContext";
import { useToast } from "@/hooks/use-toast";
import { normalizeWirelessSystems } from "@/lib/wirelessSystemNormalizer";
import { mapFestivalGearSetup } from "@/utils/festivalGearMappers";
import type { FestivalGearSetup } from "@/types/festival";
import { asString, type ArtistFormState, type RiderFileRecord } from "@/components/festival/artistRequirementsFormModel";

interface Options {
  isBlank: boolean;
  token: string | undefined;
  blankJobId: string;
  blankDate: string;
  formLanguage: "es" | "en";
  tx: (es: string, en: string) => string;
  setFormData: Dispatch<SetStateAction<ArtistFormState>>;
  setRiderFiles: (files: RiderFileRecord[]) => void;
  /** Owned by the caller: the rider-files hook needs the id this loads, and this needs its setter. */
  setPublicArtistId: (id: string | null) => void;
}

/**
 * Loads what the public artist form shows: the artist's pre-filled record and the fields locked by
 * production (token mode) or the festival's gear/stages/logo (blank template), plus its logo.
 */
export function usePublicArtistFormContext({
  isBlank,
  token,
  blankJobId,
  blankDate,
  formLanguage,
  tx,
  setFormData,
  setRiderFiles,
  setPublicArtistId,
}: Options) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [stageNames, setStageNames] = useState<Record<number, string>>({});
  const [festivalLogo, setFestivalLogo] = useState<string | null>(null);
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    const loadBlankContext = async () => {
      try {
        setLockedFields(new Set());
        setStageNames({});
        setPublicArtistId(null);
        setRiderFiles([]);
        if (blankDate) setFormData((prev) => ({ ...prev, date: blankDate }));
        if (!blankJobId) return;

        const { gearData, stages, logoPath } = await fetchBlankFormContext(blankJobId);
        if (cancelled) return;
        if (gearData) setGearSetup(mapFestivalGearSetup(gearData));
        setStageNames(stageNameMap(stages));
        if (logoPath) {
          const resolvedLogo = await resolveFestivalLogoUrl(logoPath);
          if (!cancelled) setFestivalLogo(resolvedLogo);
        }
      } catch (error) {
        if (!cancelled) console.warn("Could not load blank form context:", error);
      }
    };

    const loadTokenContext = async () => {
      if (!token) {
        toast({
          title: tx("Error", "Error"),
          description: tx("Token de formulario inválido", "Invalid form token"),
          variant: "destructive",
        });
        return;
      }

      setStageNames({});
      const context = await fetchPublicArtistFormContext(token);
      if (cancelled) return;

      if (!context?.ok) {
        if (context?.status === "submitted") {
          navigate(`/festival/form-submitted?lang=${formLanguage}`, { replace: true });
          return;
        }
        toast({
          title: tx("Formulario no disponible", "Form unavailable"),
          description:
            context?.status === "expired"
              ? tx("Este enlace de formulario ha expirado.", "This form link has expired.")
              : tx(
                  "No se pudo abrir este formulario. Verifica que el enlace sea válido.",
                  "Could not open this form. Verify that the link is valid.",
                ),
          variant: "destructive",
        });
        return;
      }

      const artist = context.artist || {};
      setPublicArtistId(asString(artist.id) || null);
      setRiderFiles(parseRiderFiles(context.rider_files));
      setLockedFields(computeLockedFields(artist));
      setFormData((prev) => artistToFormState(artist, prev));

      if (context.gear_setup) {
        setGearSetup({
          ...context.gear_setup,
          wireless_systems: normalizeWirelessSystems(context.gear_setup.wireless_systems, "wireless"),
          iem_systems: normalizeWirelessSystems(context.gear_setup.iem_systems, "iem"),
        });
      }

      const contextStages = stageNameMap(Array.isArray(context.stage_names) ? context.stage_names : []);
      const artistJobId = asString(artist.job_id);
      if (Object.keys(contextStages).length > 0) {
        setStageNames(contextStages);
      } else if (artistJobId) {
        const stages = await fetchJobStageNames(artistJobId);
        if (!cancelled) setStageNames(stageNameMap(stages));
      }

      const resolvedLogo = await resolveFestivalLogoUrl(context.logo_file_path);
      if (!cancelled) setFestivalLogo(resolvedLogo);
    };

    const fetchContext = async () => {
      setIsLoading(true);
      try {
        await (isBlank ? loadBlankContext() : loadTokenContext());
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading form context:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudieron cargar los datos del formulario.", "Could not load form data."),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchContext();
    return () => {
      cancelled = true;
    };
  }, [blankDate, blankJobId, formLanguage, isBlank, navigate, setFormData, setPublicArtistId, setRiderFiles, token, toast, tx]);

  return { isLoading, gearSetup, stageNames, festivalLogo, setFestivalLogo, lockedFields };
}
