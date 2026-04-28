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
          backgroundColor: color ? `${color}25` : "#6366f125",
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
        "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400"
      )}
    >
      #{label}
    </span>
  );
}
