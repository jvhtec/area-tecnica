import { useState, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { BasicInfoSection } from "./form/sections/BasicInfoSection";
import { ConsoleSetupSection } from "./form/sections/ConsoleSetupSection";
import { ArtistWirelessSetupSection } from "./form/sections/ArtistWirelessSetupSection";
import { MonitorSetupSection } from "./form/sections/MonitorSetupSection";
import { ExtraRequirementsSection } from "./form/sections/ExtraRequirementsSection";
import { InfrastructureSection } from "./form/sections/InfrastructureSection";
import { NotesSection } from "./form/sections/NotesSection";
import { MicKitSection } from "./form/sections/MicKitSection";
import { PublicRiderSection } from "./form/PublicRiderSection";
import { Loader2, Printer } from "lucide-react";
import { usePublicArtistRiderFiles } from "@/hooks/festival/usePublicArtistRiderFiles";
import { usePublicArtistFormContext } from "@/hooks/festival/usePublicArtistFormContext";
import { usePublicArtistFormSubmit } from "@/hooks/festival/usePublicArtistFormSubmit";

import {
  createInitialFormData,
  type ArtistFormState,
  type ArtistRequirementsFormProps,
} from "@/components/festival/artistRequirementsFormModel";

export const ArtistRequirementsForm = ({ isBlank = false }: ArtistRequirementsFormProps) => {
  const { token } = useParams();
  const [searchParams] = useSearchParams();

  const blankJobId = searchParams.get("jobId") || "";
  const blankDate = searchParams.get("date") || "";
  const formLanguage = searchParams.get("lang") === "en" ? "en" : "es";
  const tx = useCallback((es: string, en: string) => (formLanguage === "en" ? en : es), [formLanguage]);

  const [companyLogo, setCompanyLogo] = useState("/sector pro logo.png");
  const [publicArtistId, setPublicArtistId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ArtistFormState>(() => createInitialFormData(isBlank, blankDate));
  const {
    deletingRiderId,
    downloadRiderFile,
    formatFileSize,
    formatUploadedAt,
    handleDeleteRider,
    handleRiderUpload,
    isUploadingRider,
    openRiderFile,
    riderFiles,
    setRiderFiles,
  } = usePublicArtistRiderFiles({ token, publicArtistId, formLanguage, tx });

  const { isLoading, gearSetup, stageNames, festivalLogo, setFestivalLogo, lockedFields } = usePublicArtistFormContext({
    isBlank,
    token,
    blankJobId,
    blankDate,
    formLanguage,
    tx,
    setFormData,
    setRiderFiles,
    setPublicArtistId,
  });

  const { handleSubmit, isSubmitting } = usePublicArtistFormSubmit({
    formData,
    formLanguage,
    isBlank,
    token,
    tx,
  });

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

  const shouldShowRiderSection = !isBlank && (formData.rider_missing || riderFiles.length > 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-[min(96vw,1900px)] mx-auto space-y-8">
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 print:p-0">
      <div className="max-w-[min(96vw,1900px)] mx-auto space-y-8 print:space-y-4">
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
                {shouldShowRiderSection && (
                  <PublicRiderSection
                    riderMissing={Boolean(formData.rider_missing)}
                    riderFiles={riderFiles}
                    deletingRiderId={deletingRiderId}
                    isUploadingRider={isUploadingRider}
                    tx={tx}
                    formatFileSize={formatFileSize}
                    formatUploadedAt={formatUploadedAt}
                    onOpen={openRiderFile}
                    onDownload={downloadRiderFile}
                    onDelete={handleDeleteRider}
                    onUpload={handleRiderUpload}
                  />
                )}

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
                  <div className="space-y-4">
                    <BasicInfoSection
                      formData={formData}
                      onChange={handleFormChange}
                      gearSetup={gearSetup}
                      isFieldLocked={isFieldLocked}
                      language={formLanguage}
                      stageNames={stageNames}
                      showInternalFlags={false}
                      showLoadInAndLineCheck
                      showSoundcheckTimes={false}
                    />
                    <ConsoleSetupSection
                      formData={formData}
                      onChange={handleFormChange}
                      gearSetup={gearSetup}
                      isFieldLocked={isFieldLocked}
                      language={formLanguage}
                    />
                    <MonitorSetupSection
                      formData={formData}
                      onChange={handleFormChange}
                      gearSetup={gearSetup}
                      isFieldLocked={isFieldLocked}
                      language={formLanguage}
                    />
                  </div>

                  <div className="space-y-4">
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
                    <ArtistWirelessSetupSection
                      formData={formData}
                      onChange={handleFormChange}
                      gearSetup={gearSetup}
                      isFieldLocked={isFieldLocked}
                      language={formLanguage}
                    />
                  </div>

                  <div className="space-y-4">
                    <ExtraRequirementsSection
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
                  </div>
                </div>

                {!isBlank && (
                  <SubmitButton type="submit" loading={isSubmitting} loadingText={tx("Enviando...", "Sending...")} className="w-full">
                    {tx("Enviar Requerimientos", "Submit Requirements")}
                  </SubmitButton>
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
            onError={() => setCompanyLogo("/media/ce3ff31a-4cc5-43c8-b5bb-a4056d3735e4.png")}
          />
        </div>
      </div>
    </div>
  );
};

export default ArtistRequirementsForm;
