import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { createContextualCan } from "@casl/react";
import type { AppAbility } from "@/lib/ability";

const AbilityContext = createContext<AppAbility>(undefined!);

export const Can = createContextualCan(AbilityContext.Consumer);

export function useAppAbility(): AppAbility {
  return useContext(AbilityContext);
}

interface AbilityProviderProps {
  ability: AppAbility;
  children: ReactNode;
}

export function AbilityProvider({ ability, children }: AbilityProviderProps) {
  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
}
