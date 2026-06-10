import { useCallback, useEffect, useState } from "react";
import type { TechnicalDepartment } from "@/features/technical-tools/power/types";
import {
  DEFAULT_FIXTURE_TYPE,
  FIXTURE_PF,
  type ConsumosComponent,
  type FixtureType,
} from "./config";

export type CustomPowerComponentInput = {
  name: string;
  watts: number;
  fixtureType?: FixtureType;
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const STORAGE_KEY_PREFIX = "sector-pro:consumos-components:v1";

const getBrowserStorage = () =>
  typeof window === "undefined" ? undefined : window.localStorage;

export const customPowerComponentsStorageKey = (
  department: TechnicalDepartment,
  ownerId = "anonymous",
) => `${STORAGE_KEY_PREFIX}:${ownerId}:${department}`;

const isFixtureType = (value: unknown): value is FixtureType =>
  typeof value === "string" && value in FIXTURE_PF;

const sanitizeComponent = (
  value: unknown,
  department: TechnicalDepartment,
): ConsumosComponent | null => {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Record<string, unknown>;
  const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
  const watts = Number(candidate.watts);
  const id =
    typeof candidate.id === "string" || typeof candidate.id === "number"
      ? candidate.id
      : null;

  if (!id || !name || !Number.isFinite(watts) || watts <= 0) return null;

  return {
    id,
    name,
    watts,
    ...(department === "lights"
      ? {
          fixtureType: isFixtureType(candidate.fixtureType)
            ? candidate.fixtureType
            : DEFAULT_FIXTURE_TYPE,
        }
      : {}),
  };
};

export const readCustomPowerComponents = (
  department: TechnicalDepartment,
  storage?: StorageLike,
  ownerId?: string,
): ConsumosComponent[] => {
  if (!storage) return [];

  try {
    const rawValue = storage.getItem(
      customPowerComponentsStorageKey(department, ownerId),
    );
    if (!rawValue) return [];
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((component) => sanitizeComponent(component, department))
      .filter((component): component is ConsumosComponent => component !== null);
  } catch (error) {
    console.warn("Failed to load custom power components", error);
    return [];
  }
};

export const writeCustomPowerComponents = (
  department: TechnicalDepartment,
  components: ConsumosComponent[],
  storage?: StorageLike,
  ownerId?: string,
) => {
  if (!storage) return;

  try {
    storage.setItem(
      customPowerComponentsStorageKey(department, ownerId),
      JSON.stringify(components),
    );
  } catch (error) {
    console.warn("Failed to save custom power components", error);
  }
};

const createComponentId = (department: TechnicalDepartment) => {
  const uniquePart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `custom:${department}:${uniquePart}`;
};

export const useCustomPowerComponents = (
  department: TechnicalDepartment,
  ownerId?: string,
) => {
  const [customComponents, setCustomComponents] = useState<ConsumosComponent[]>(() =>
    readCustomPowerComponents(department, getBrowserStorage(), ownerId),
  );

  useEffect(() => {
    setCustomComponents(
      readCustomPowerComponents(department, getBrowserStorage(), ownerId),
    );
  }, [department, ownerId]);

  const addCustomComponent = useCallback(
    (input: CustomPowerComponentInput) => {
      const component: ConsumosComponent = {
        id: createComponentId(department),
        name: input.name.trim(),
        watts: input.watts,
        ...(department === "lights"
          ? { fixtureType: input.fixtureType || DEFAULT_FIXTURE_TYPE }
          : {}),
      };

      setCustomComponents((previous) => {
        const next = [...previous, component];
        writeCustomPowerComponents(
          department,
          next,
          getBrowserStorage(),
          ownerId,
        );
        return next;
      });

      return component;
    },
    [department, ownerId],
  );

  return { customComponents, addCustomComponent };
};
