import { createContext, useContext, type ReactNode } from "react";
import type { Unit } from "@/config/units";

const UnitContext = createContext<Unit | null>(null);

export function UnitProvider({ unit, children }: { unit: Unit; children: ReactNode }) {
  return <UnitContext.Provider value={unit}>{children}</UnitContext.Provider>;
}

export function useUnit(): Unit {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error("useUnit deve ser usado dentro de um <UnitProvider>");
  return ctx;
}
