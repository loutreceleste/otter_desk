import { CheckCircle2, Loader2, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";
import type { PairingInfo } from "../../../../shared/terminalTypes";
import { cancelPairing, onTerminalsPaired, startPairing, unpairProvider } from "../../lib/terminals";

const PROVIDER = "vscode";

interface PairingModalProps {
  /** true si un appairage existe déjà (propose la révocation). */
  paired: boolean;
  onClose: () => void;
}

export function PairingModal({ paired, onClose }: PairingModalProps) {
  const [info, setInfo] = useState<PairingInfo | null>(null);
  const [now, setNow] = useState(Date.now());
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const begin = async () => {
    setError(null);
    setDone(false);
    try {
      setInfo(await startPairing(PROVIDER));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    if (!paired) void begin();
    const off = onTerminalsPaired(() => {
      setDone(true);
      setInfo(null);
    });
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      off();
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    if (info && !done) void cancelPairing(PROVIDER);
    onClose();
  };

  const remaining = info ? Math.max(0, Math.round((info.expiresAt - now) / 1000)) : 0;
  const expired = info !== null && remaining === 0;

  return createPortal(
    <Modal title="Connecter VS Code" onClose={close}>
      <div className="flex flex-col gap-4 text-sm text-zinc-600 dark:text-zinc-300">
        {done ? (
          <div className="flex items-start gap-3">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-500 mt-0.5" />
            <p>
              VS Code est connecté. Toutes les fenêtres VS Code où l'extension OtterDesk est active apparaissent
              désormais dans « Envoyer vers… ».
            </p>
          </div>
        ) : info ? (
          <>
            <p>Dans VS Code, ouvrez la palette de commandes (⇧⌘P) et lancez :</p>
            <p className="font-medium text-zinc-800 dark:text-zinc-100">« OtterDesk : Connecter à OtterDesk »</p>
            <p>puis saisissez ce code :</p>
            <div className="flex items-center justify-center py-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700">
              <span className="font-mono text-2xl tracking-[0.2em] font-medium text-zinc-900 dark:text-zinc-100 select-text">
                {info.code}
              </span>
            </div>
            {expired ? (
              <p className="text-amber-600 dark:text-amber-400">Code expiré.</p>
            ) : (
              <p className="flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 size={12} className="animate-spin" />
                En attente de VS Code… (code valable encore {remaining} s, 3 essais maximum)
              </p>
            )}
          </>
        ) : paired ? (
          <p>
            OtterDesk est appairé avec l'extension VS Code. Vous pouvez générer un nouveau code (l'appairage actuel sera
            remplacé) ou révoquer l'accès.
          </p>
        ) : null}

        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}

        {confirmRevoke && (
          <p className="text-red-600 dark:text-red-400">
            Révoquer l'appairage déconnecte toutes les fenêtres VS Code. Un nouveau code sera nécessaire.
          </p>
        )}

        <div className="flex justify-between gap-2 pt-1">
          {paired && !done ? (
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (!confirmRevoke) return setConfirmRevoke(true);
                await unpairProvider(PROVIDER);
                onClose();
              }}
            >
              <Unplug size={13} />
              {confirmRevoke ? "Confirmer la révocation" : "Révoquer l'appairage"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {!done && (paired || expired) && (
              <Button variant="secondary" size="sm" onClick={() => void begin()}>
                Nouveau code
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={close}>
              {done ? "Terminé" : "Fermer"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
