import { useLayoutEffect } from "react";

export interface TenantTheme {
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  destructive?: string;
  destructiveForeground?: string;
  background?: string;
  foreground?: string;
  radius?: string;
  fontSans?: string;
  fontHeading?: string;
  logoUrl?: string;
}

const THEME_CSS_MAP: Record<string, string> = {
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  destructiveForeground: "--destructive-foreground",
  background: "--background",
  foreground: "--foreground",
  radius: "--radius",
  fontSans: "--font-sans",
  fontHeading: "--font-heading",
};

export function ThemeProvider({
  theme,
  children,
}: {
  theme: TenantTheme | null;
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    if (!theme) return;

    const root = document.documentElement;
    const applied: string[] = [];

    for (const [key, cssVar] of Object.entries(THEME_CSS_MAP)) {
      const value = theme[key as keyof TenantTheme];
      if (value != null) {
        root.style.setProperty(cssVar, value);
        applied.push(cssVar);
      }
    }

    return () => {
      for (const cssVar of applied) {
        root.style.removeProperty(cssVar);
      }
    };
  }, [theme]);

  return <>{children}</>;
}
