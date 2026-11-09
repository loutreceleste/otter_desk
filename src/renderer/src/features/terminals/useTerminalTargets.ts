import { useCallback, useEffect, useRef, useState } from "react";
import type { TerminalListResult } from "../../../../shared/terminalTypes";
import { listTerminals, onTerminalsChanged } from "../../lib/terminals";

/**
 * Liste des terminaux disponibles, rafraîchie à l'activation (ouverture du menu)
 * puis à chaque changement signalé par le processus principal tant qu'elle est active.
 */
export function useTerminalTargets(active: boolean) {
  const [data, setData] = useState<TerminalListResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    try {
      const result = await listTerminals();
      if (id === seq.current) {
        setData(result);
        setError(null);
      }
    } catch (e) {
      if (id === seq.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void refresh();
    return onTerminalsChanged(() => void refresh());
  }, [active, refresh]);

  return { data, loading, error, refresh };
}
