import { clsx } from "clsx";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  size?: "md" | "lg";
}

export function Modal({ title, onClose, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={clsx(
          "relative bg-white dark:bg-zinc-800 rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-700 w-full flex flex-col max-h-[90vh] overflow-hidden",
          size === "md" ? "max-w-md" : "max-w-2xl"
        )}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-700 shrink-0">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
