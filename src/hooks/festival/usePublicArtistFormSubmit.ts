import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useToast } from "@/hooks/use-toast";
import { dataLayerClient } from "@/services/dataLayerClient";
import type { ArtistFormState, PublicSubmitResponse } from "@/components/festival/artistRequirementsFormModel";

type Options = {
  formData: ArtistFormState;
  formLanguage: "es" | "en";
  isBlank: boolean;
  token?: string;
  tx: (spanish: string, english: string) => string;
};

export const usePublicArtistFormSubmit = ({ formData, formLanguage, isBlank, token, tx }: Options) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (e: FormEvent) => {
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
      const { data, error } = await dataLayerClient.functions.invoke("submit-public-artist-form", {
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

  return { handleSubmit, isSubmitting };
};
