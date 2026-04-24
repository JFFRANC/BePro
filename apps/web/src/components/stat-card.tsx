import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendColor?: string;
  icon: React.ComponentType<{ className?: string }>;
  borderColor: string;
  valueColor: string;
  iconBg: string;
  showTrendIcon?: boolean;
}

// Hook: anima un numero desde su valor previo al nuevo con easing ease-out
// durante 600ms. Respeta prefers-reduced-motion saltando al valor final.
function useCountUp(target: number | string): number | string {
  const [display, setDisplay] = useState<number | string>(target);
  const prevRef = useRef<number | string>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = target;

    if (typeof target !== "number" || typeof prev !== "number") {
      setDisplay(target);
      return;
    }

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setDisplay(target);
      return;
    }

    if (prev === target) {
      return;
    }

    const start = performance.now();
    const duration = 600;
    const from = prev;
    const delta = target - from;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + delta * eased;
      setDisplay(Number.isInteger(target) ? Math.round(current) : Number(current.toFixed(2)));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target]);

  return display;
}

export function StatCard({
  label,
  value,
  trend,
  trendColor,
  icon: Icon,
  borderColor,
  valueColor,
  iconBg,
  showTrendIcon,
}: StatCardProps) {
  const displayValue = useCountUp(value);
  return (
    <Card
      className={cn(
        "shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-t-[3px]",
        borderColor,
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <div
            className={cn(
              "size-8 rounded-lg flex items-center justify-center",
              iconBg,
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        <CardTitle
          className={cn("!text-4xl font-bold font-heading tabular-nums", valueColor)}
        >
          {displayValue}
        </CardTitle>
      </CardHeader>
      {trend && (
        <CardContent>
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-medium",
              trendColor,
            )}
          >
            {showTrendIcon && <TrendingUp className="size-3" />}
            {trend}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
