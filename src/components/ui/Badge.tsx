import { clsx } from "clsx";

interface BadgeProps {
  label: string;
  color?: string;
  variant?: "category" | "tag";
}

export function Badge({ label, color, variant = "tag" }: BadgeProps) {
  if (variant === "category") {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
        style={{
          backgroundColor: color ? `${color}20` : "#6366f120",
          color: color ?? "#6366f1",
        }}
      >
        {label}
      </span>
    );
  }
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
      )}
    >
      #{label}
    </span>
  );
}
