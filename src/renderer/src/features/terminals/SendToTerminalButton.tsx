import { clsx } from "clsx";
import { Loader2, Play, RefreshCw, Settings2, SquareTerminal } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { checkSendableCommand } from "../../../../shared/commandSafety";
import type { SendMode, SendResult, TerminalTarget } from "../../../../shared/terminalTypes";
import { getRevealAfterSend } from "../../lib/preferences";
import { getLastTarget, sendToTerminal, setLastTarget } from "../../lib/terminals";
import { PairingModal } from "./PairingModal";
import { useTerminalTargets } from "./useTerminalTargets";

export interface SendFeedback {
  kind: "success" | "warning" | "error";
  message: string;
}

interface Props {
  /** Texte affiché (contrôle local : bouton désactivé pour une commande non envoyable). */
  text: string;
  /** Référence transmise au processus principal, qui relit le texte en base. */
  commandId: number;
  /** Index de l'étape de la commande (0 pour une commande simple). */
  step: number;
  projectId: number;
  onFeedback: (f: SendFeedback) => void;
  /** Classes du bouton (alignées sur celles du bouton Copier). */
  buttonClassName: string;
}

const MENU_WIDTH = 330;

function stateBadge(t: TerminalTarget) {
  if (t.state === "idle") return { dot: "bg-emerald-500", label: "prêt" };
  if (t.state === "busy") return { dot: "bg-amber-500", label: t.runningCommand ? `occupé : ${t.runningCommand}` : "occupé" };
  return { dot: "bg-zinc-400", label: "état inconnu" };
}

// Transmission ≠ réussite : OtterDesk ne connaît pas le résultat de la commande.
function successFeedback(r: Extract<SendResult, { ok: true }>): SendFeedback {
  if (r.reveal && !r.reveal.revealed) {
    return {
      kind: "warning",
      message: `Envoyée vers ${r.targetLabel}, mais impossible d'afficher le terminal.`,
    };
  }
  return { kind: "success", message: `Envoyée vers ${r.targetLabel}` };
}

export function SendToTerminalButton({ text, commandId, step, projectId, onFeedback, buttonClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [pairing, setPairing] = useState<{ paired: boolean } | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data, loading, error, refresh } = useTerminalTargets(open);

  const check = useMemo(() => checkSendableCommand(text), [text]);
  const lastId = open ? getLastTarget(projectId) : null;

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; detail?: string; targets: TerminalTarget[] }>();
    for (const t of data?.targets ?? []) {
      if (!map.has(t.groupId)) map.set(t.groupId, { label: t.groupLabel, detail: t.groupDetail, targets: [] });
      map.get(t.groupId)!.targets.push(t);
    }
    for (const g of map.values()) g.targets.sort((a, b) => a.index - b.index);
    return [...map.values()];
  }, [data]);

  const lastMissing = Boolean(lastId && data && !data.targets.some((t) => t.id === lastId));
  const vscode = data?.providers.find((p) => p.id === "vscode");

  // ─── Positionnement (portail, position fixe, retournement vers le haut) ────
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const place = () => {
      const r = buttonRef.current!.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const menuH = menuRef.current?.offsetHeight ?? 240;
      const below = vh - r.bottom - 8;
      const above = r.top - 8;
      const up = below < Math.min(menuH, 260) && above > below;
      const maxHeight = Math.max(160, Math.min(up ? above : below, vh * 0.7));
      const left = Math.min(Math.max(8, r.right - MENU_WIDTH), vw - MENU_WIDTH - 8);
      const top = up ? Math.max(8, r.top - 4 - Math.min(menuH, maxHeight)) : r.bottom + 4;
      setPos({ top, left, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open, data, loading]);

  // ─── Fermeture : clic extérieur, Échap, défilement de la page ─────────────
  useLayoutEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !buttonRef.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Focus initial : dernier terminal utilisé, sinon première entrée.
  useLayoutEffect(() => {
    if (!open || !data || !menuRef.current) return;
    const items = [...menuRef.current.querySelectorAll<HTMLElement>("[data-menu-item]")];
    const preferred = lastId ? items.find((el) => el.dataset.targetId === lastId) : undefined;
    (preferred ?? items[0])?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, data === null]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      return close();
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  // ─── Envoi ─────────────────────────────────────────────────────────────────
  // Le renderer ne transmet qu'une référence (commande + étape) : le processus principal
  // relit le texte en base, applique les règles et affiche lui-même toute confirmation
  // (boîte de dialogue native). Aucune confirmation ne peut être fournie d'ici.
  const doSend = async (target: TerminalTarget, mode: SendMode) => {
    if (sending || !check.ok) return;
    setSending(true);
    try {
      const result = await sendToTerminal({
        targetId: target.id,
        commandId,
        step,
        mode,
        reveal: getRevealAfterSend(),
      });
      if (result.ok) {
        setLastTarget(projectId, target.id);
        setOpen(false);
        onFeedback(successFeedback(result));
      } else if (result.code === "cancelled") {
        // Annulé par l'utilisateur dans la boîte de dialogue : rien à signaler.
      } else {
        const uncertain = result.code === "timeout" || result.code === "duplicate";
        onFeedback({ kind: uncertain ? "warning" : "error", message: result.message });
        if (result.code === "target-disconnected" || result.code === "state-changed") void refresh();
      }
    } catch (e) {
      onFeedback({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSending(false);
    }
  };

  const disabledReason = !check.ok ? check.message : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabledReason && setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-disabled={Boolean(disabledReason)}
        className={clsx(
          buttonClassName,
          "outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          disabledReason && "opacity-40 cursor-not-allowed"
        )}
        title={disabledReason ?? "Envoyer vers un terminal…"}
      >
        {sending ? <Loader2 size={13} className="animate-spin" /> : <SquareTerminal size={13} />}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Envoyer vers un terminal"
            onKeyDown={onMenuKeyDown}
            style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: MENU_WIDTH, maxHeight: pos?.maxHeight }}
            className="z-50 flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl overflow-hidden text-xs"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-100 dark:border-zinc-700 shrink-0">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">Envoyer vers…</span>
              <button
                type="button"
                onClick={() => void refresh()}
                className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                title="Actualiser la liste"
              >
                <RefreshCw size={12} className={clsx(loading && "animate-spin")} />
              </button>
            </div>

            <div className="overflow-y-auto py-1">
              {!data && loading && (
                <p className="flex items-center gap-2 px-3 py-3 text-zinc-400">
                  <Loader2 size={12} className="animate-spin" /> Recherche des terminaux…
                </p>
              )}
              {error && <p className="px-3 py-2 text-red-600 dark:text-red-400">{error}</p>}

              {lastMissing && (
                <p className="mx-3 my-1 px-2 py-1.5 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                  Le dernier terminal utilisé pour ce projet n'est plus disponible : choisissez-en un autre.
                </p>
              )}

              {groups.map((g) => (
                <div key={g.label + (g.detail ?? "")} className="py-1">
                  <div className="px-3 pt-1 pb-0.5">
                    <p className="font-semibold text-zinc-500 dark:text-zinc-400 truncate">{g.label}</p>
                    {g.detail && <p className="text-[10px] text-zinc-400 truncate" title={g.detail}>{g.detail}</p>}
                  </div>
                  {g.targets.map((t) => {
                    const badge = stateBadge(t);
                    const isLast = t.id === lastId;
                    return (
                      <div key={t.id} className="group/row flex items-center gap-1 px-1.5">
                        <button
                          type="button"
                          role="menuitem"
                          data-menu-item
                          data-target-id={t.id}
                          disabled={sending || !t.canInsert}
                          onClick={() => void doSend(t, "insert")}
                          title={t.canInsert ? "Insérer la commande sans l'exécuter" : t.note}
                          className={clsx(
                            "flex-1 min-w-0 flex flex-col items-start px-2 py-1.5 rounded-lg text-left outline-none",
                            "focus-visible:ring-2 focus-visible:ring-indigo-500",
                            t.canInsert
                              ? "hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:bg-zinc-100 dark:focus:bg-zinc-700"
                              : "cursor-default"
                          )}
                        >
                          <span className="flex items-center gap-1.5 w-full min-w-0">
                            <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", badge.dot)} />
                            <span className="truncate text-zinc-800 dark:text-zinc-100">{t.name}</span>
                            {isLast && (
                              <span className="shrink-0 px-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-[10px] text-indigo-600 dark:text-indigo-300">
                                Dernier
                              </span>
                            )}
                          </span>
                          <span className="pl-3 text-[10px] text-zinc-400 truncate w-full">
                            {badge.label}
                            {t.cwd ? ` · ${t.cwd}` : ""}
                            {!t.canInsert && t.canExecute ? " · exécution uniquement" : ""}
                          </span>
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          data-menu-item
                          disabled={sending || !t.canExecute}
                          onClick={() => void doSend(t, "execute")}
                          title={t.canExecute ? "Insérer et exécuter (Entrée)" : t.note}
                          className={clsx(
                            "shrink-0 flex items-center gap-1 px-2 py-1 rounded-md border outline-none focus-visible:ring-2 focus-visible:ring-amber-500",
                            t.canExecute
                              ? "border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                              : "border-zinc-200 dark:border-zinc-700 text-zinc-300 dark:text-zinc-600 cursor-not-allowed"
                          )}
                        >
                          <Play size={10} />
                          Exécuter
                        </button>
                      </div>
                    );
                  })}
                </div>
              ))}

              {data && data.targets.length === 0 && !loading && (
                <p className="px-3 py-3 text-zinc-500 dark:text-zinc-400">
                  Aucun terminal disponible. Vous pouvez toujours utiliser Copier.
                </p>
              )}

              {/* État des intégrations (non connectées, autorisations…) */}
              {data?.providers
                .filter((p) => p.status !== "ready" && p.status !== "not-running" && p.message)
                .map((p) => (
                  <p key={p.id} className="px-3 py-1 text-[10px] text-zinc-400">
                    <span className="font-medium">{p.label} :</span> {p.message}
                  </p>
                ))}
            </div>

            <div className="flex items-center justify-between gap-2 px-3 py-2 border-t border-zinc-100 dark:border-zinc-700 shrink-0">
              <span className="text-[10px] text-zinc-400">Clic : insérer · ▶ : exécuter</span>
              <button
                type="button"
                data-menu-item
                onClick={() => setPairing({ paired: vscode !== undefined && vscode.status !== "not-paired" })}
                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Settings2 size={11} />
                {vscode?.status === "not-paired" ? "Connecter VS Code…" : "Connexion VS Code"}
              </button>
            </div>
          </div>,
          document.body
        )}

      {pairing && (
        <PairingModal
          paired={pairing.paired}
          onClose={() => {
            setPairing(null);
            void refresh();
          }}
        />
      )}
    </>
  );
}
