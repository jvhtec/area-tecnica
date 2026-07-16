import chainmasterLogoUrl from "@/assets/motor-brands/chainmaster.jpg?no-inline";
import cmLogoUrl from "@/assets/motor-brands/cm.jpg?no-inline";
import liftketLogoUrl from "@/assets/motor-brands/liftket.png?no-inline";

export type MotorBrandKey = "chainmaster" | "liftket" | "cm";

type MotorBrandAsset = {
  mimeType: "image/jpeg" | "image/png";
  url: string;
};

export const MOTOR_BRAND_LOGOS: Record<MotorBrandKey, MotorBrandAsset> = {
  chainmaster: {
    mimeType: "image/jpeg",
    url: chainmasterLogoUrl,
  },
  liftket: {
    mimeType: "image/png",
    url: liftketLogoUrl,
  },
  cm: {
    mimeType: "image/jpeg",
    url: cmLogoUrl,
  },
};

/** Resolves Flex manufacturer/model text to a supported local logo. */
export const resolveMotorBrandKey = (
  manufacturer: string | null,
  modelName: string,
): MotorBrandKey | null => {
  const value = `${manufacturer ?? ""} ${modelName}`.toLowerCase();
  if (/chain ?master/.test(value)) return "chainmaster";
  if (value.includes("liftket")) return "liftket";
  if (/columbus mckinnon|(^|\s)cm(\s|$)|lodestar/.test(value)) return "cm";
  return null;
};

/** Loads a bundled, same-origin logo without adding its bytes to the JavaScript bundle. */
export const loadMotorBrandLogo = async (
  brand: MotorBrandKey,
  fetchImage: typeof fetch = globalThis.fetch,
): Promise<ArrayBuffer> => {
  const asset = MOTOR_BRAND_LOGOS[brand];
  const response = await fetchImage(asset.url);
  if (!response.ok) {
    throw new Error("No se pudo cargar el logotipo local.");
  }
  return response.arrayBuffer();
};
