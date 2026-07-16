import chainmasterLogoUrl from "@/assets/motor-brands/chainmaster.jpg?no-inline";
import cmLogoUrl from "@/assets/motor-brands/cm.jpg?no-inline";
import liftketLogoUrl from "@/assets/motor-brands/liftket.png?no-inline";

export type MotorBrandKey = "chainmaster" | "liftket" | "cm";

type MotorBrandAsset = {
  label: string;
  mimeType: "image/jpeg" | "image/png";
  url: string;
};

export const MOTOR_BRAND_LOGOS: Record<MotorBrandKey, MotorBrandAsset> = {
  chainmaster: {
    label: "ChainMaster",
    mimeType: "image/jpeg",
    url: chainmasterLogoUrl,
  },
  liftket: {
    label: "LIFTKET",
    mimeType: "image/png",
    url: liftketLogoUrl,
  },
  cm: {
    label: "CM",
    mimeType: "image/jpeg",
    url: cmLogoUrl,
  },
};

/** Resolves Flex manufacturer/model text to a supported local logo. */
export const resolveMotorBrandKey = (
  manufacturer: string | null,
  modelName: string,
): MotorBrandKey | null => {
  const value = `${manufacturer ?? ""} ${modelName}`.toLocaleLowerCase("en");
  if (value.includes("chainmaster") || value.includes("chain master")) return "chainmaster";
  if (value.includes("liftket")) return "liftket";
  if (
    value.includes("columbus mckinnon")
    || /(^|\s)cm(\s|$)/.test(value)
    || value.includes("lodestar")
  ) {
    return "cm";
  }
  return null;
};

/** Loads a bundled, same-origin logo without adding its bytes to the JavaScript bundle. */
export const loadMotorBrandLogo = async (
  brand: MotorBrandKey,
  fetchImage: typeof fetch = globalThis.fetch,
): Promise<Uint8Array> => {
  const asset = MOTOR_BRAND_LOGOS[brand];
  const response = await fetchImage(asset.url);
  if (!response.ok) {
    throw new Error(`No se pudo cargar el logotipo local de ${asset.label}.`);
  }
  return new Uint8Array(await response.arrayBuffer());
};
