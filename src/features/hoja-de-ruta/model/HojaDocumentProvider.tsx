import type { ReactNode } from "react";

import {
  HojaDocumentContext,
  type HojaDocumentStore,
} from "@/features/hoja-de-ruta/model/HojaDocumentContext";

export const HojaDocumentProvider = ({
  value,
  children,
}: {
  value: HojaDocumentStore;
  children: ReactNode;
}) => (
  <HojaDocumentContext.Provider value={value}>
    {children}
  </HojaDocumentContext.Provider>
);
