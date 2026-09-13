"use client";

import { createContext, useContext } from "react";

const PackDoWizardCtx = createContext<string | null>(null);

export function PackDoWizardProvider({
  packId,
  children,
}: {
  packId: string | null;
  children: React.ReactNode;
}) {
  return <PackDoWizardCtx.Provider value={packId}>{children}</PackDoWizardCtx.Provider>;
}

export function usePackDoWizard(): string | null {
  return useContext(PackDoWizardCtx);
}
