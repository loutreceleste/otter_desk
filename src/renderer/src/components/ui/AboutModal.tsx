import { AlertTriangle, FileText, FolderOpen, Keyboard, Settings2, Tag, Terminal } from "lucide-react";
import { useState } from "react";
import headbandUrl from "../../assets/headband.png";
import { useAppInfo } from "../../lib/appInfo";
import { getRevealAfterSend, setRevealAfterSend } from "../../lib/preferences";
import { terminalsSupported } from "../../lib/terminals";
import { Modal } from "./Modal";
import { Switch } from "./Switch";

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
  const info = useAppInfo();
  const [revealAfterSend, setReveal] = useState(getRevealAfterSend);
  const shortcut = info?.shortcut;

  return (
    <Modal title="À propos d'OtterDesk" onClose={onClose}>
      <div className="space-y-5">
        {/* Logo + version */}
        <div className="flex items-center gap-4">
          <img
            src={headbandUrl}
            alt="OtterDesk"
            className="h-10 object-contain object-left dark:invert-0 invert"
            draggable={false}
          />
          {info && (
            <span className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
              v{info.version}
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
          OtterDesk est un gestionnaire local de commandes CLI et de notes, pensé pour les développeurs
          qui veulent garder leurs snippets, scripts et mémos organisés par projet — sans cloud, sans compte,
          tout reste sur votre machine.
        </p>

        {/* Fonctionnalités */}
        <ul className="space-y-2">
          {[
            { icon: FolderOpen, label: "Projets", desc: "Organisez vos commandes et notes par projet" },
            { icon: Terminal, label: "Commandes", desc: "Snippets CLI, scripts multi-étapes, copie en un clic" },
            { icon: FileText, label: "Notes", desc: "Notes riches avec mise en forme (gras, listes…)" },
            { icon: Tag, label: "Tags & catégories", desc: "Filtrez et retrouvez vos éléments rapidement" },
          ].map(({ icon: Icon, label, desc }) => (
            <li key={label} className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
                <Icon size={13} className="text-indigo-600 dark:text-indigo-400" />
              </span>
              <span className="text-xs text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold text-zinc-800 dark:text-zinc-100">{label}</span>
                {" — "}
                {desc}
              </span>
            </li>
          ))}
        </ul>

        {/* Raccourci clavier */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Keyboard size={13} className="text-zinc-500 dark:text-zinc-400" />
            <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              Raccourci global
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">Afficher / masquer OtterDesk</span>
            <div className="ml-auto flex items-center gap-1">
              {(shortcut?.keys ?? []).map((k) => (
                <kbd key={k} className="px-1.5 py-0.5 text-xs font-mono rounded bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 shadow-sm">
                  {k}
                </kbd>
              ))}
            </div>
          </div>
          {shortcut && !shortcut.registered && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              {shortcut.message ?? "Raccourci inactif."}
            </p>
          )}
        </div>

        {/* Préférences (envoi vers les terminaux : macOS) */}
        {terminalsSupported && (
          <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Settings2 size={13} className="text-zinc-500 dark:text-zinc-400" />
              <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Préférences</p>
            </div>
            <Switch
              id="pref-reveal-terminal"
              checked={revealAfterSend}
              onChange={(v) => {
                setReveal(v);
                setRevealAfterSend(v);
              }}
              label="Afficher le terminal après l'envoi"
              description="Met automatiquement au premier plan le terminal sélectionné après l'envoi d'une commande."
            />
          </div>
        )}

        {/* Licence */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 px-4 py-3">
          <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
            Licence MIT
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Logiciel libre et open-source. Vous êtes libre de l'utiliser, le modifier et le redistribuer
            sans restriction, sous réserve de conserver la notice de copyright.
          </p>
        </div>

      </div>
    </Modal>
  );
}
