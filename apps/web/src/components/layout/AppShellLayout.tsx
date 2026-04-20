import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SkipToContent } from "./SkipToContent";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function AppShellLayout() {
  return (
    <TooltipProvider>
      <SkipToContent />
      <div className="min-h-dvh bg-background text-foreground">
        <Header />
        <div className="grid grid-cols-[1fr] md:grid-cols-[auto_1fr]">
          <Sidebar />
          <main
            id="main"
            className="min-w-0"
            tabIndex={-1}
          >
            <div
              data-slot="main-inner"
              className="mx-auto w-full max-w-screen-2xl px-4 py-6 md:px-6 lg:px-8"
            >
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
