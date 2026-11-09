import { useEffect, useState } from "react";
import type { AppInfo } from "../../../shared/appInfo";

// Une seule requête au processus principal pour toute la session.
let cached: Promise<AppInfo> | null = null;

export function getAppInfo(): Promise<AppInfo> {
  cached ??= window.api.app.getInfo();
  return cached;
}

/** Version réelle de l'application et état du raccourci global (null pendant le chargement). */
export function useAppInfo(): AppInfo | null {
  const [info, setInfo] = useState<AppInfo | null>(null);
  useEffect(() => {
    let alive = true;
    getAppInfo().then((i) => alive && setInfo(i)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return info;
}
