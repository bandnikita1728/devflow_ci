import { cn } from "@/lib/utils";

const severityConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  critical: {
    label: "Critical",
    bg: "bg-gh-error-bg",
    text: "text-gh-error",
    border: "border-[#cf222e40]",
  },
  error: {
    label: "Error",
    bg: "bg-gh-error-bg",
    text: "text-gh-error",
    border: "border-[#cf222e40]",
  },
  warning: {
    label: "Warning",
    bg: "bg-gh-warning-bg",
    text: "text-gh-warning",
    border: "border-[#9a670040]",
  },
  info: {
    label: "Info",
    bg: "bg-[#ddf4ff]",
    text: "text-[#0969da]",
    border: "border-[#0969da40]",
  },
  suggestion: {
    label: "Suggestion",
    bg: "bg-gh-sidebar",
    text: "text-gh-text-secondary",
    border: "border-gh-border",
  },
};

interface SeverityBadgeProps {
  severity: string;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = severityConfig[severity.toLowerCase()] ?? {
    label: severity,
    bg: "bg-gh-sidebar",
    text: "text-gh-text-secondary",
    border: "border-gh-border",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[2em] border px-2 py-[1px] text-[12px] font-medium leading-[18px]",
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {config.label}
    </span>
  );
}
