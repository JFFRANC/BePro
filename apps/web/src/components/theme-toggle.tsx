import { useState } from "react";
import { Sun, Moon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const [isDark, setIsDark] = useState(
    document.documentElement.classList.contains("dark"),
  );

  function toggleDarkMode() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  }

  return (
    <div className="fixed top-4 right-4 z-50">
      <button
        onClick={toggleDarkMode}
        className={cn(
          "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
          "border border-border/60 bg-card/80 backdrop-blur-md shadow-lg",
          "transition-all hover:shadow-xl hover:scale-105",
        )}
      >
        {isDark ? (
          <>
            <Sun className="size-4 text-warning" />
            <span>Claro</span>
          </>
        ) : (
          <>
            <Moon className="size-4 text-info" />
            <span>Oscuro</span>
          </>
        )}
      </button>
    </div>
  );
}
