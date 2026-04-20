import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions, type RenderResult } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";

interface RenderWithRouterOptions extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  routes?: string[];
}

export function renderWithRouter(
  ui: ReactElement,
  { route = "/", routes, ...options }: RenderWithRouterOptions = {},
): RenderResult {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={routes ?? [route]}>
      <TooltipProvider>{children}</TooltipProvider>
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}
