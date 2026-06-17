import { cn } from "@/lib/utils";

const severityConfig: Record<string, { label: string; bg: string; text: string }> = {
  critical: {
    label: "Critical",
    bg: "bg-red-50",
    text: "text-red-700",
  },
  error: {
    label: "Error",
    bg: "bg-red-50",
    text: "text-red-700",
  },
  warning: {
    label: "Warning",
    bg: "bg-amber-50",
    text: "text-amber-700",
  },
  info: {
    label: "Info",
    bg: "bg-blue-50",
    text: "text-blue-700",
  },
  suggestion: {
    label: "Suggestion",
    bg: "bg-slate-100",
    text: "text-slate-600",
  },
};

interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity.toLowerCase()] ?? {
    label: severity,
    bg: "bg-slate-100",
    text: "text-slate-600",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      {config.label}
    </span>
  );
}
