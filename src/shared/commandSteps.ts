// Découpage d'une commande enregistrée en étapes (module pur, partagé renderer / main).
// Le champ « command » contient soit une commande simple, soit un tableau JSON d'étapes :
//   ["cmd1", "cmd2"]  ou  [{ "label": "…", "cmd": "…" }, …]
// Le processus principal utilise la même fonction pour retrouver le texte exact à envoyer
// vers un terminal : le renderer ne transmet que l'identifiant de la commande et l'étape.

export interface CommandStep {
  label: string;
  cmd: string;
}

export function parseCommandSteps(raw: string): CommandStep[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (typeof parsed[0] === "string") {
        return parsed.map((cmd) => ({ label: "", cmd: typeof cmd === "string" ? cmd : String(cmd) }));
      }
      return parsed.map((s) => {
        const step = (typeof s === "object" && s !== null ? s : {}) as { label?: unknown; cmd?: unknown };
        return {
          label: typeof step.label === "string" ? step.label : "",
          cmd: typeof step.cmd === "string" ? step.cmd : "",
        };
      });
    }
  } catch {
    /* commande simple (texte non JSON) */
  }
  return [{ label: "", cmd: raw }];
}
