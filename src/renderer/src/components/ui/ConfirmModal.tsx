import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Supprimer",
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-500 dark:text-red-400" />
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed pt-1.5">
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button variant="danger" onClick={() => { onConfirm(); onClose(); }}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
