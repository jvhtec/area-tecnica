import type {
  TourGuestLink,
  TourOpsAllowedSections
} from "@/features/tour-ops/types";
import { dataLayerClient } from "@/services/dataLayerClient";

const client = dataLayerClient;

export async function fetchTourGuestLinks(tourId: string): Promise<TourGuestLink[]> {
  const { data, error } = await client
    .from("tour_guest_links")
    .select("id, tour_id, token, label, allowed_sections, access_level, expires_at, revoked_at, created_at")
    .eq("tour_id", tourId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TourGuestLink[];
}

export async function createTourGuestLink(input: {
  tourId: string;
  label: string;
  allowedSections: TourOpsAllowedSections;
  accessLevel?: "view" | "edit";
  expiresAt?: string | null;
}): Promise<TourGuestLink> {
  const { data, error } = await client.rpc("create_tour_guest_link", {
    p_tour_id: input.tourId,
    p_label: input.label,
    p_allowed_sections: input.allowedSections,
    p_expires_at: input.expiresAt || null,
    p_access_level: input.accessLevel || "view",
  });
  if (error) throw error;
  const link = data?.[0] as TourGuestLink | undefined;
  if (!link) {
    throw new Error("No se pudo crear el enlace externo");
  }
  return link;
}

export async function revokeTourGuestLink(linkId: string) {
  const { error } = await client.rpc("revoke_tour_guest_link", { p_link_id: linkId });
  if (error) throw error;
}

export async function setTourGuestLinkAccess(input: { linkId: string; accessLevel: "disabled" | "view" | "edit" }) {
  const { error } = await client.rpc("set_tour_guest_link_access", {
    p_link_id: input.linkId,
    p_access_level: input.accessLevel,
  });
  if (error) throw error;
}

export async function updateTourDocumentGuestVisibility(documentId: string, visibleToGuest: boolean) {
  const { error } = await client
    .from("tour_documents")
    .update({ visible_to_guest: visibleToGuest })
    .eq("id", documentId);
  if (error) throw error;
}
