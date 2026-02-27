import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BasicInfoSection } from "./form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { ArtistWirelessSetupSection } from "./form/sections/ArtistWirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { MicKitSection } from "./form/sections/MicKitSection";
import { FestivalGearSetup, WirelessSetup } from "@/types/festival";
import { ArtistSectionProps } from "@/types/artist-form";
import { Download, Eye, FileText, Loader2, Printer, Trash2 } from "lucide-react";

interface ArtistRequirementsFormProps {
  isBlank?: boolean;
}

interface PublicFormContextResponse {
  ok: boolean;
  error?: string;
  status?: string;
  artist?: Record<string, unknown>;
  gear_setup?: FestivalGearSetup | null;
  logo_file_path?: string | null;
  stage_names?: Array<{ number?: number; name?: string }>;
  rider_files?: Array<Record<string, unknown>>;
}

interface PublicSubmitResponse {
  ok: boolean;
  error?: string;
  status?: string;
}

type ArtistFormState = ArtistSectionProps["formData"];
type RiderFileRecord = {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
};

const makeBlankSystem = () => ({
  model: "",
  quantity: 0,
  quantity_hh: 0,
  quantity_bp: 0,
  band: "",
  provided_by: "festival",
});

const normalizeTime = (value: string | null | undefined) => {
  if (!value) return "";
  return value.length >= 5 ? value.slice(0, 5) : value;
};

const asString = (value: unknown) => (typeof value === "string" ? value : "");
const asBoolean = (value: unknown) => (typeof value === "boolean" ? value : false);
const asNumber = (value: unknown) => (typeof value === "number" ? value : 0);
const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const hasText = (value: unknown) => asString(value).trim().length > 0;
const hasPositiveNumber = (value: unknown) => asNumber(value) > 0;

const normalizeFestivalLogoPath = (filePath: string) => {
  let normalized = filePath.trim();
  if (!normalized) return "";
  if (normalized.startsWith("http")) return normalized;
  if (normalized.startsWith("/")) normalized = normalized.slice(1);
  if (normalized.startsWith("festival-logos/")) {
    normalized = normalized.slice("festival-logos/".length);
  }
  return normalized;
};

const createInitialFormData = (isBlank: boolean, blankDate = ""): ArtistFormState => ({
  name: "",
  stage: 1,
  date: blankDate,
  show_start: "",
  show_end: "",
  soundcheck: false,
  soundcheck_start: "",
  soundcheck_end: "",
  foh_console: "",
  foh_console_provided_by: "festival",
  foh_tech: false,
  mon_console: "",
  mon_console_provided_by: "festival",
  monitors_from_foh: false,
  foh_waves_outboard: "",
  mon_waves_outboard: "",
  mon_tech: false,
  wireless_systems: isBlank ? [makeBlankSystem()] : [],
  iem_systems: isBlank ? [makeBlankSystem()] : [],
  wireless_provided_by: "festival",
  iem_provided_by: "festival",
  monitors_enabled: false,
  monitors_quantity: 0,
  extras_sf: false,
  extras_df: false,
  extras_djbooth: false,
  extras_wired: "",
  infra_cat6: false,
  infra_cat6_quantity: 0,
  infra_hma: false,
  infra_hma_quantity: 0,
  infra_coax: false,
  infra_coax_quantity: 0,
  infra_opticalcon_duo: false,
  infra_opticalcon_duo_quantity: 0,
  infra_analog: 0,
  infrastructure_provided_by: "festival",
  other_infrastructure: "",
  notes: "",
  rider_missing: false,
  isaftermidnight: false,
  mic_kit: "band",
  wired_mics: [],
});

export const ArtistRequirementsForm = ({ isBlank = false }: ArtistRequirementsFormProps) => {
  const { token } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const blankJobId = searchParams.get("jobId") || "";
  const blankDate = searchParams.get("date") || "";
  const formLanguage = searchParams.get("lang") === "en" ? "en" : "es";
  const tx = useCallback((es: string, en: string) => (formLanguage === "en" ? en : es), [formLanguage]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [gearSetup, setGearSetup] = useState<FestivalGearSetup | null>(null);
  const [stageNames, setStageNames] = useState<Record<number, string>>({});
  const [festivalLogo, setFestivalLogo] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState("/sector pro logo.png");
  const [lockedFields, setLockedFields] = useState<Set<string>>(new Set());
  const [publicArtistId, setPublicArtistId] = useState<string | null>(null);
  const [riderFiles, setRiderFiles] = useState<RiderFileRecord[]>([]);
  const [isUploadingRider, setIsUploadingRider] = useState(false);
  const [deletingRiderId, setDeletingRiderId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ArtistFormState>(() => createInitialFormData(isBlank, blankDate));

  const resolveFestivalLogoUrl = useCallback(async (rawFilePath: string | null | undefined) => {
    if (!rawFilePath) {
      return null;
    }

    const normalizedPath = normalizeFestivalLogoPath(rawFilePath);
    if (!normalizedPath) {
      return null;
    }

    if (normalizedPath.startsWith("http")) {
      return normalizedPath;
    }

    try {
      const { data: signedData, error: signedError } = await supabase.storage
        .from("festival-logos")
        .createSignedUrl(normalizedPath, 60 * 60);

      if (!signedError && signedData?.signedUrl) {
        return signedData.signedUrl;
      }
    } catch (error) {
      console.warn("Could not create signed logo URL:", error);
    }

    const { data } = supabase.storage.from("festival-logos").getPublicUrl(normalizedPath);
    if (data?.publicUrl) {
      return data.publicUrl;
    }

    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadBlankContext = async () => {
      try {
        setLockedFields(new Set());
        setStageNames({});
        setPublicArtistId(null);
        setRiderFiles([]);
        if (cancelled) return;
        if (blankDate) {
          setFormData((prev) => ({ ...prev, date: blankDate }));
        }

        if (!blankJobId) {
          return;
        }

        const { data: gearData } = await supabase
          .from("festival_gear_setups")
          .select("*")
          .eq("job_id", blankJobId)
          .maybeSingle();

        if (cancelled) return;
        if (gearData) {
          setGearSetup(gearData as FestivalGearSetup);
        }

        const { data: stagesData } = await supabase
          .from("festival_stages")
          .select("number, name")
          .eq("job_id", blankJobId);

        if (!cancelled && stagesData) {
          const stageMap = stagesData.reduce<Record<number, string>>((acc, stage) => {
            if (typeof stage.number === "number" && stage.name) {
              acc[stage.number] = stage.name;
            }
            return acc;
          }, {});
          setStageNames(stageMap);
        }

        const { data: logoData } = await supabase
          .from("festival_logos")
          .select("file_path")
          .eq("job_id", blankJobId)
          .maybeSingle();

        if (cancelled) return;
        if (logoData?.file_path) {
          const resolvedLogo = await resolveFestivalLogoUrl(logoData.file_path);
          if (!cancelled) {
            setFestivalLogo(resolvedLogo);
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.warn("Could not load blank form context:", error);
      }
    };

    const loadTokenContext = async () => {
      if (!token) {
        if (cancelled) return;
        toast({
          title: tx("Error", "Error"),
          description: tx("Token de formulario inválido", "Invalid form token"),
          variant: "destructive",
        });
        return;
      }

      setStageNames({});

      const { data, error } = await supabase.rpc("get_public_artist_form_context", {
        p_token: token,
      });

      if (cancelled) return;
      if (error) {
        throw error;
      }

      const context = data as PublicFormContextResponse;
      if (!context?.ok) {
        if (context?.status === "submitted") {
          if (cancelled) return;
          navigate(`/festival/form-submitted?lang=${formLanguage}`, { replace: true });
          return;
        }

        if (cancelled) return;
        const description =
          context?.status === "expired"
            ? tx("Este enlace de formulario ha expirado.", "This form link has expired.")
            : tx("No se pudo abrir este formulario. Verifica que el enlace sea válido.", "Could not open this form. Verify that the link is valid.");

        toast({
          title: tx("Formulario no disponible", "Form unavailable"),
          description,
          variant: "destructive",
        });
        return;
      }

      const artistData = context.artist || {};
      const artistJobId = asString(artistData.job_id);
      const artistId = asString(artistData.id);
      const contextStageNames = Array.isArray(context.stage_names) ? context.stage_names : [];
      const contextRiderFiles = asArray<Record<string, unknown>>(context.rider_files).map((file) => ({
        id: asString(file.id),
        file_name: asString(file.file_name),
        file_path: asString(file.file_path),
        file_type: asString(file.file_type) || null,
        file_size: typeof file.file_size === "number" ? file.file_size : null,
        uploaded_at: asString(file.uploaded_at) || null,
        uploaded_by: asString(file.uploaded_by) || null,
        uploaded_by_name: asString(file.uploaded_by_name) || null,
      }));

      setPublicArtistId(artistId || null);
      setRiderFiles(contextRiderFiles.filter((file) => file.id && file.file_path));
      const hasSystems = (value: unknown) =>
        asArray<Record<string, unknown>>(value).some((system) => {
          return (
            hasText(system?.model) ||
            hasPositiveNumber(system?.quantity) ||
            hasPositiveNumber(system?.quantity_hh) ||
            hasPositiveNumber(system?.quantity_bp)
          );
        });
      const hasWiredMics = (value: unknown) =>
        asArray<Record<string, unknown>>(value).some((mic) => {
          return hasText(mic?.model) || hasPositiveNumber(mic?.quantity);
        });

      const nextLockedFields = new Set<string>(["name", "stage", "date", "show_start", "show_end"]);
      if (hasText(artistData.foh_console)) {
        nextLockedFields.add("foh_console");
        nextLockedFields.add("foh_console_provided_by");
      }
      if (hasText(artistData.foh_waves_outboard)) nextLockedFields.add("foh_waves_outboard");
      if (asBoolean(artistData.foh_tech)) nextLockedFields.add("foh_tech");
      if (hasText(artistData.mon_console)) {
        nextLockedFields.add("mon_console");
        nextLockedFields.add("mon_console_provided_by");
      }
      if (asBoolean(artistData.monitors_from_foh)) nextLockedFields.add("monitors_from_foh");
      if (hasText(artistData.mon_waves_outboard)) nextLockedFields.add("mon_waves_outboard");
      if (asBoolean(artistData.mon_tech)) nextLockedFields.add("mon_tech");
      if (hasSystems(artistData.wireless_systems)) {
        nextLockedFields.add("wireless_systems");
        nextLockedFields.add("wireless_provided_by");
      }
      if (hasSystems(artistData.iem_systems)) {
        nextLockedFields.add("iem_systems");
        nextLockedFields.add("iem_provided_by");
      }
      if (asBoolean(artistData.monitors_enabled) || hasPositiveNumber(artistData.monitors_quantity)) {
        nextLockedFields.add("monitors_enabled");
        nextLockedFields.add("monitors_quantity");
      }
      if (asBoolean(artistData.extras_sf)) nextLockedFields.add("extras_sf");
      if (asBoolean(artistData.extras_df)) nextLockedFields.add("extras_df");
      if (asBoolean(artistData.extras_djbooth)) nextLockedFields.add("extras_djbooth");
      if (hasText(artistData.extras_wired)) nextLockedFields.add("extras_wired");

      const hasInfrastructure =
        asBoolean(artistData.infra_cat6) ||
        hasPositiveNumber(artistData.infra_cat6_quantity) ||
        asBoolean(artistData.infra_hma) ||
        hasPositiveNumber(artistData.infra_hma_quantity) ||
        asBoolean(artistData.infra_coax) ||
        hasPositiveNumber(artistData.infra_coax_quantity) ||
        asBoolean(artistData.infra_opticalcon_duo) ||
        hasPositiveNumber(artistData.infra_opticalcon_duo_quantity) ||
        hasPositiveNumber(artistData.infra_analog) ||
        hasText(artistData.other_infrastructure);

      if (asBoolean(artistData.infra_cat6)) nextLockedFields.add("infra_cat6");
      if (hasPositiveNumber(artistData.infra_cat6_quantity)) nextLockedFields.add("infra_cat6_quantity");
      if (asBoolean(artistData.infra_hma)) nextLockedFields.add("infra_hma");
      if (hasPositiveNumber(artistData.infra_hma_quantity)) nextLockedFields.add("infra_hma_quantity");
      if (asBoolean(artistData.infra_coax)) nextLockedFields.add("infra_coax");
      if (hasPositiveNumber(artistData.infra_coax_quantity)) nextLockedFields.add("infra_coax_quantity");
      if (asBoolean(artistData.infra_opticalcon_duo)) nextLockedFields.add("infra_opticalcon_duo");
      if (hasPositiveNumber(artistData.infra_opticalcon_duo_quantity)) nextLockedFields.add("infra_opticalcon_duo_quantity");
      if (hasPositiveNumber(artistData.infra_analog)) nextLockedFields.add("infra_analog");
      if (hasText(artistData.other_infrastructure)) nextLockedFields.add("other_infrastructure");
      if (hasInfrastructure) nextLockedFields.add("infrastructure_provided_by");

      if (hasText(artistData.notes)) nextLockedFields.add("notes");
      if (asBoolean(artistData.rider_missing)) nextLockedFields.add("rider_missing");
      if (asBoolean(artistData.isaftermidnight)) nextLockedFields.add("isaftermidnight");
      if (hasWiredMics(artistData.wired_mics)) {
        nextLockedFields.add("wired_mics");
        nextLockedFields.add("mic_kit");
      } else if (asString(artistData.mic_kit) === "festival" || asString(artistData.mic_kit) === "mixed") {
        nextLockedFields.add("mic_kit");
      }

      setLockedFields(nextLockedFields);

      setFormData((prev) => ({
        ...prev,
        name: asString(artistData.name),
        stage: asNumber(artistData.stage) || 1,
        date: asString(artistData.date),
        show_start: normalizeTime(asString(artistData.show_start)),
        show_end: normalizeTime(asString(artistData.show_end)),
        soundcheck: asBoolean(artistData.soundcheck),
        soundcheck_start: normalizeTime(asString(artistData.soundcheck_start)),
        soundcheck_end: normalizeTime(asString(artistData.soundcheck_end)),
        foh_console: asString(artistData.foh_console),
        foh_console_provided_by: asString(artistData.foh_console_provided_by) || "festival",
        foh_tech: asBoolean(artistData.foh_tech),
        foh_waves_outboard: asString(artistData.foh_waves_outboard),
        mon_console: asString(artistData.mon_console),
        mon_console_provided_by: asString(artistData.mon_console_provided_by) || "festival",
        monitors_from_foh: asBoolean(artistData.monitors_from_foh),
        mon_waves_outboard: asString(artistData.mon_waves_outboard),
        mon_tech: asBoolean(artistData.mon_tech),
        wireless_systems: asArray<WirelessSetup>(artistData.wireless_systems),
        iem_systems: asArray<WirelessSetup>(artistData.iem_systems),
        wireless_provided_by: asString(artistData.wireless_provided_by) || "festival",
        iem_provided_by: asString(artistData.iem_provided_by) || "festival",
        monitors_enabled: asBoolean(artistData.monitors_enabled),
        monitors_quantity: asNumber(artistData.monitors_quantity),
        extras_sf: asBoolean(artistData.extras_sf),
        extras_df: asBoolean(artistData.extras_df),
        extras_djbooth: asBoolean(artistData.extras_djbooth),
        extras_wired: asString(artistData.extras_wired),
        infra_cat6: asBoolean(artistData.infra_cat6),
        infra_cat6_quantity: asNumber(artistData.infra_cat6_quantity),
        infra_hma: asBoolean(artistData.infra_hma),
        infra_hma_quantity: asNumber(artistData.infra_hma_quantity),
        infra_coax: asBoolean(artistData.infra_coax),
        infra_coax_quantity: asNumber(artistData.infra_coax_quantity),
        infra_opticalcon_duo: asBoolean(artistData.infra_opticalcon_duo),
        infra_opticalcon_duo_quantity: asNumber(artistData.infra_opticalcon_duo_quantity),
        infra_analog: asNumber(artistData.infra_analog),
        infrastructure_provided_by: asString(artistData.infrastructure_provided_by) || "festival",
        other_infrastructure: asString(artistData.other_infrastructure),
        notes: asString(artistData.notes),
        rider_missing: asBoolean(artistData.rider_missing),
        isaftermidnight: asBoolean(artistData.isaftermidnight),
        mic_kit: (asString(artistData.mic_kit) === "festival" || asString(artistData.mic_kit) === "mixed")
          ? (asString(artistData.mic_kit) as "festival" | "mixed")
          : "band",
        wired_mics: asArray<Record<string, unknown>>(artistData.wired_mics).map((mic) => ({
          model: asString(mic.model),
          quantity: asNumber(mic.quantity),
          exclusive_use: asBoolean(mic.exclusive_use),
          notes: asString(mic.notes),
        })),
      }));

      if (context.gear_setup) {
        setGearSetup(context.gear_setup);
      }

      const stageMapFromContext = contextStageNames.reduce<Record<number, string>>((acc, stage) => {
        if (typeof stage.number === "number" && stage.name) {
          acc[stage.number] = stage.name;
        }
        return acc;
      }, {});

      if (Object.keys(stageMapFromContext).length > 0) {
        setStageNames(stageMapFromContext);
      } else if (artistJobId) {
        const { data: stagesData } = await supabase
          .from("festival_stages")
          .select("number, name")
          .eq("job_id", artistJobId);

        if (!cancelled && stagesData) {
          const stageMap = stagesData.reduce<Record<number, string>>((acc, stage) => {
            if (typeof stage.number === "number" && stage.name) {
              acc[stage.number] = stage.name;
            }
            return acc;
          }, {});
          setStageNames(stageMap);
        }
      }

      const resolvedLogo = await resolveFestivalLogoUrl(context.logo_file_path);
      if (cancelled) return;
      setFestivalLogo(resolvedLogo);
    };

    const fetchContext = async () => {
      if (cancelled) return;
      setIsLoading(true);
      try {
        if (isBlank) {
          await loadBlankContext();
        } else {
          await loadTokenContext();
        }
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading form context:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudieron cargar los datos del formulario.", "Could not load form data."),
          variant: "destructive",
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void fetchContext();

    return () => {
      cancelled = true;
    };
  }, [blankDate, blankJobId, isBlank, navigate, resolveFestivalLogoUrl, token, toast, tx]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isBlank) return;

    if (!token) {
      toast({
        title: tx("Error", "Error"),
        description: tx("Token de formulario inválido", "Invalid form token"),
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("submit-public-artist-form", {
        body: {
          token,
          formData,
        },
      });

      if (error) {
        throw error;
      }

      const result = data as PublicSubmitResponse;
      if (!result?.ok) {
        if (result?.status === "submitted") {
          navigate(`/festival/form-submitted?lang=${formLanguage}`, { replace: true });
          return;
        }

        const description =
          result?.error === "form_expired"
            ? tx("Este enlace ha expirado.", "This link has expired.")
            : result?.error === "already_submitted"
              ? tx("Este artista ya envió el formulario.", "This artist has already submitted the form.")
              : tx("No se pudo enviar el formulario.", "Could not submit the form.");

        toast({
          title: tx("Formulario no disponible", "Form unavailable"),
          description,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: tx("Éxito", "Success"),
        description: tx("Sus requerimientos técnicos han sido enviados correctamente.", "Your technical requirements were submitted successfully."),
      });

      navigate(`/festival/form-submitted?lang=${formLanguage}`);
    } catch (error) {
      console.error("Error submitting form:", error);
      toast({
        title: tx("Error", "Error"),
        description: tx("No se pudo enviar el formulario. Por favor intente más tarde.", "Could not submit the form. Please try again later."),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFormChange = (changes: Partial<ArtistFormState>) => {
    if (isBlank || lockedFields.size === 0) {
      setFormData((prev) => ({ ...prev, ...changes }));
      return;
    }

    const unlockedChanges = Object.entries(changes).reduce<Partial<ArtistFormState>>((acc, [key, value]) => {
      if (!lockedFields.has(key)) {
        (acc as Record<string, unknown>)[key] = value;
      }
      return acc;
    }, {});

    if (Object.keys(unlockedChanges).length === 0) return;
    setFormData((prev) => ({ ...prev, ...unlockedChanges }));
  };

  const isFieldLocked = useCallback(
    (field: string) => !isBlank && lockedFields.has(field),
    [isBlank, lockedFields]
  );

  const formatUploadedAt = useCallback(
    (uploadedAt: string | null) => {
      if (!uploadedAt) return tx("Fecha desconocida", "Unknown date");
      const date = new Date(uploadedAt);
      if (Number.isNaN(date.getTime())) return tx("Fecha desconocida", "Unknown date");
      return new Intl.DateTimeFormat(formLanguage === "en" ? "en-GB" : "es-ES", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Madrid",
      }).format(date);
    },
    [formLanguage, tx]
  );

  const formatFileSize = useCallback(
    (value: number | null) => {
      if (!value || value <= 0) return tx("Tamaño desconocido", "Unknown size");
      if (value < 1024) return `${value} B`;
      if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${(value / (1024 * 1024)).toFixed(1)} MB`;
    },
    [tx]
  );

  const openRiderFile = useCallback(
    async (file: RiderFileRecord) => {
      try {
        const { data, error } = await supabase.storage
          .from("festival_artist_files")
          .createSignedUrl(file.file_path, 60 * 60);

        if (error || !data?.signedUrl) {
          throw error ?? new Error("Could not create signed URL");
        }

        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error("Error opening rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo abrir el rider.", "Could not open rider file."),
          variant: "destructive",
        });
      }
    },
    [toast, tx]
  );

  const downloadRiderFile = useCallback(
    async (file: RiderFileRecord) => {
      try {
        const { data, error } = await supabase.storage
          .from("festival_artist_files")
          .download(file.file_path);

        if (error || !data) {
          throw error ?? new Error("Could not download file");
        }

        const url = window.URL.createObjectURL(data);
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = file.file_name;
        window.document.body.appendChild(anchor);
        anchor.click();
        window.document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Error downloading rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo descargar el rider.", "Could not download rider file."),
          variant: "destructive",
        });
      }
    },
    [toast, tx]
  );

  const handleRiderUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.target;
      const selectedFiles = Array.from(input.files || []);
      if (selectedFiles.length === 0) return;

      if (!token || !publicArtistId) {
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo identificar este formulario público.", "Could not identify this public form."),
          variant: "destructive",
        });
        input.value = "";
        return;
      }

      setIsUploadingRider(true);

      try {
        const payload = new FormData();
        payload.append("token", token);
        selectedFiles.forEach((file) => payload.append("files", file));

        const { data, error } = await supabase.functions.invoke("upload-public-artist-rider", {
          body: payload,
        });

        if (error) {
          throw error;
        }

        const response = data as {
          ok?: boolean;
          error?: string;
          file?: Record<string, unknown> | null;
          files?: Array<Record<string, unknown>>;
        } | null;
        if (!response?.ok) {
          throw new Error(response?.error || "upload_failed");
        }

        const uploadedRaw =
          Array.isArray(response.files) && response.files.length > 0
            ? response.files
            : response.file
              ? [response.file]
              : [];

        const uploaded = uploadedRaw
          .map((file) => ({
            id: asString(file.id),
            file_name: asString(file.file_name),
            file_path: asString(file.file_path),
            file_type: asString(file.file_type) || null,
            file_size: typeof file.file_size === "number" ? file.file_size : null,
            uploaded_at: asString(file.uploaded_at) || null,
            uploaded_by: asString(file.uploaded_by) || null,
            uploaded_by_name: asString(file.uploaded_by_name) || null,
          }))
          .filter((file) => file.id && file.file_path);

        if (uploaded.length === 0) {
          throw new Error("invalid_upload_response");
        }

        setRiderFiles((prev) => {
          const deduped = prev.filter((existing) => !uploaded.some((nextFile) => nextFile.id === existing.id));
          return [...uploaded, ...deduped];
        });

        toast({
          title: tx("Éxito", "Success"),
          description:
            uploaded.length > 1
              ? tx("Riders cargados correctamente.", "Rider files uploaded successfully.")
              : tx("Rider cargado correctamente.", "Rider uploaded successfully."),
        });
      } catch (error) {
        console.error("Error uploading rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx(
            "No se pudo cargar el rider. Inténtalo de nuevo.",
            "Could not upload rider file. Please try again."
          ),
          variant: "destructive",
        });
      } finally {
        setIsUploadingRider(false);
        input.value = "";
      }
    },
    [publicArtistId, toast, token, tx]
  );

  const handleDeleteRider = useCallback(
    async (file: RiderFileRecord) => {
      if (!token || !file.id) return;
      setDeletingRiderId(file.id);

      try {
        const { data, error } = await supabase.functions.invoke("delete-public-artist-rider", {
          body: {
            token,
            fileId: file.id,
          },
        });

        if (error) {
          throw error;
        }

        const response = data as { ok?: boolean; error?: string } | null;
        if (!response?.ok) {
          throw new Error(response?.error || "delete_failed");
        }

        setRiderFiles((prev) => prev.filter((item) => item.id !== file.id));

        toast({
          title: tx("Éxito", "Success"),
          description: tx("Rider eliminado.", "Rider file deleted."),
        });
      } catch (error) {
        console.error("Error deleting rider file:", error);
        toast({
          title: tx("Error", "Error"),
          description: tx("No se pudo eliminar el rider.", "Could not delete rider file."),
          variant: "destructive",
        });
      } finally {
        setDeletingRiderId(null);
      }
    },
    [toast, token, tx]
  );

  const shouldShowRiderSection = !isBlank && (formData.rider_missing || riderFiles.length > 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 print:p-0">
      <div className="max-w-4xl mx-auto space-y-8 print:space-y-4">
        <div className="flex flex-col items-center space-y-8 print:space-y-4">
          {festivalLogo && (
            <img
              src={festivalLogo}
              alt="Festival Logo"
              width={192}
              height={64}
              loading="eager"
              decoding="async"
              className="h-16 w-48 object-contain"
              onError={() => setFestivalLogo(null)}
            />
          )}

          {isBlank && (
            <div className="w-full flex justify-end print:hidden">
              <Button type="button" variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                {tx("Imprimir Formulario en Blanco", "Print Blank Form")}
              </Button>
            </div>
          )}

          <Card className="w-full print:shadow-none print:border-none">
            <CardHeader>
              <CardTitle>
                {isBlank
                  ? tx("Formulario de Requerimientos Técnicos del Artista (En Blanco)", "Artist Technical Requirements Form (Blank)")
                  : tx("Formulario de Requerimientos Técnicos del Artista", "Artist Technical Requirements Form")}
              </CardTitle>
              {!isBlank && lockedFields.size > 0 && (
                <p className="text-sm text-muted-foreground">
                  {tx(
                    "Algunos campos fueron pre-cargados por producción y están bloqueados.",
                    "Some fields were pre-filled by production and are locked."
                  )}
                </p>
              )}
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-8">
                <BasicInfoSection
                  formData={formData}
                  onChange={handleFormChange}
                  gearSetup={gearSetup}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                  stageNames={stageNames}
                  showInternalFlags={false}
                  showSoundcheckTimes={false}
                />

                {shouldShowRiderSection && (
                  <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="text-lg font-semibold">{tx("Rider Técnico", "Technical Rider")}</h3>

                    {formData.rider_missing && (
                      <p className="text-sm font-medium text-destructive">
                        {tx(
                          "Aún no hemos recibido el rider técnico de este artista. Por favor súbelo en esta sección.",
                          "We have not received this artist's technical rider yet. Please upload it in this section."
                        )}
                      </p>
                    )}

                    {riderFiles.length > 0 ? (
                      <div className="rounded-md border p-3 space-y-3">
                        {riderFiles.map((file) => (
                          <div key={file.id} className="flex flex-col gap-3 border rounded-md p-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-medium">
                                <FileText className="h-4 w-4" />
                                <span>{file.file_name}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {tx("Subido", "Uploaded")}: {formatUploadedAt(file.uploaded_at)} ·{" "}
                                {formatFileSize(file.file_size)}
                              </p>
                              {file.uploaded_by_name && (
                                <p className="text-xs text-muted-foreground">
                                  {tx("Subido por", "Uploaded by")}: {file.uploaded_by_name}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => openRiderFile(file)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                {tx("Ver", "View")}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => downloadRiderFile(file)}
                              >
                                <Download className="h-4 w-4 mr-2" />
                                {tx("Descargar", "Download")}
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={deletingRiderId === file.id}
                                onClick={() => handleDeleteRider(file)}
                              >
                                {deletingRiderId === file.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4 mr-2" />
                                )}
                                {tx("Eliminar", "Delete")}
                              </Button>
                            </div>
                          </div>
                        ))}
                        <p className="text-xs text-muted-foreground">
                          {tx(
                            "Estos son los riders actuales que tenemos registrados. Si existe una versión más nueva, súbela usando el campo inferior y elimina las versiones erróneas.",
                            "These are the rider files we currently have on file. If there is a newer version, upload it below and delete any incorrect versions."
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {tx(
                          "No hay ningún rider cargado actualmente para este artista.",
                          "There is currently no rider file uploaded for this artist."
                        )}
                      </p>
                    )}

                    <div className="space-y-2">
                      <label htmlFor="public-rider-upload" className="text-sm font-medium">
                        {tx("Subir rider(s) (PDF, Word o imagen)", "Upload rider file(s) (PDF, Word, or image)")}
                      </label>
                      <Input
                        id="public-rider-upload"
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                        multiple
                        onChange={handleRiderUpload}
                        disabled={isUploadingRider}
                      />
                      {isUploadingRider && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {tx("Subiendo rider...", "Uploading rider...")}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <ConsoleSetupSection
                  formData={formData}
                  onChange={handleFormChange}
                  gearSetup={gearSetup}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                />

                <ArtistWirelessSetupSection
                  formData={formData}
                  onChange={handleFormChange}
                  gearSetup={gearSetup}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                />

                <MicKitSection
                  micKit={formData.mic_kit}
                  wiredMics={formData.wired_mics}
                  onMicKitChange={(provider) => handleFormChange({ mic_kit: provider })}
                  onWiredMicsChange={(mics) => handleFormChange({ wired_mics: mics })}
                  readOnly={isFieldLocked("mic_kit") || isFieldLocked("wired_mics")}
                  language={formLanguage}
                  festivalAvailableMics={(gearSetup?.wired_mics || [])
                    .map((mic) => mic?.model?.trim())
                    .filter((model): model is string => Boolean(model))}
                />

                <MonitorSetupSection
                  formData={formData}
                  onChange={handleFormChange}
                  gearSetup={gearSetup}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                />

                <ExtraRequirementsSection
                  formData={formData}
                  onChange={handleFormChange}
                  gearSetup={gearSetup}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                />

                <InfrastructureSection
                  formData={formData}
                  onChange={handleFormChange}
                  gearSetup={gearSetup}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                  restrictToAvailable={!isBlank}
                />

                <NotesSection
                  formData={formData}
                  onChange={handleFormChange}
                  isFieldLocked={isFieldLocked}
                  language={formLanguage}
                />

                {!isBlank && (
                  <Button type="submit" disabled={isSubmitting} className="w-full">
                    {isSubmitting ? tx("Enviando...", "Sending...") : tx("Enviar Requerimientos", "Submit Requirements")}
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          <img
            src={companyLogo}
            alt="Company Logo"
            width={794}
            height={100}
            loading="lazy"
            decoding="async"
            className="h-16 w-48 object-contain mt-8"
            onError={() => setCompanyLogo("/lovable-uploads/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png")}
          />
        </div>
      </div>
    </div>
  );
};

export default ArtistRequirementsForm;
