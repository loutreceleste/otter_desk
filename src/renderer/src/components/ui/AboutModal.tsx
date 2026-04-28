import { FileText, FolderOpen, Keyboard, Tag, Terminal } from "lucide-react";
import headbandUrl from "../../assets/headband.png";
import { Modal } from "./Modal";

interface AboutModalProps {
  onClose: () => void;
}

export function AboutModal({ onClose }: AboutModalProps) {
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
          <span className="text-xs font-mono text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
            v{__APP_VERSION__}
          </span>
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
              {["Ctrl", "Shift", "Space"].map((k) => (
                <kbd key={k} className="px-1.5 py-0.5 text-xs font-mono rounded bg-white dark:bg-zinc-700 border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 shadow-sm">
                  {k}
                </kbd>
              ))}
            </div>
          </div>
        </div>

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
