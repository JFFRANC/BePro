import { cn } from "@/lib/utils";

interface SectionShellProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionShell({ children, className }: SectionShellProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/50 p-6 sm:p-8 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-300",
        className,
      )}
    >
      {children}
    </section>
  );
}
