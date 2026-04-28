import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center gap-1.5 font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1",
        {
          "bg-indigo-600 text-white hover:bg-indigo-700 focus:ring-indigo-500":
            variant === "primary",
          "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700 focus:ring-zinc-400":
            variant === "secondary",
          "text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:ring-zinc-400":
            variant === "ghost",
          "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 focus:ring-red-400":
            variant === "danger",
          "px-3 py-1.5 text-xs": size === "sm",
          "px-4 py-2 text-sm": size === "md",
        },
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
