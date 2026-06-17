import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  completed: {
    label: "Completed",
    bg: "bg-gh-success-bg",
    text: "text-gh-success",
    border: "border-[#1a7f3740]",
  },
  failed: {
    label: "Failed",
    bg: "bg-gh-error-bg",
    text: "text-gh-error",
    border: "border-[#cf222e40]",
  },
  pending: {
    label: "Pending",
    bg: "bg-gh-warning-bg",
    text: "text-gh-warning",
    border: "border-[#9a670040]",
  },
  processing: {
    label: "Processing",
    bg: "bg-[#ddf4ff]",
    text: "text-[#0969da]",
    border: "border-[#0969da40]",
  },
  queued: {
    label: "Queued",
    bg: "bg-gh-sidebar",
    text: "text-gh-text-secondary",
    border: "border-gh-border",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status.toLowerCase()] ?? {
    label: status,
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
