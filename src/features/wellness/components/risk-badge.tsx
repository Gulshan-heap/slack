import { AlertOctagon, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RiskBadgeProps {
  level: "low" | "medium" | "high";
  score: number;
}

const CONFIG = {
  low: {
    label: "Low risk",
    icon: CheckCircle2,
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  },
  medium: {
    label: "Medium risk",
    icon: AlertTriangle,
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  },
  high: {
    label: "High risk",
    icon: AlertOctagon,
    className: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  },
} as const;

export const RiskBadge = ({ level, score }: RiskBadgeProps) => {
  const { label, icon: Icon, className } = CONFIG[level];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      <Icon className="size-3.5" />
      {label}
      <span className="opacity-60">· {score}</span>
    </span>
  );
};
