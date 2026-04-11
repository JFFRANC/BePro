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
          className={cn("!text-4xl font-bold font-heading", valueColor)}
        >
          {value}
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
