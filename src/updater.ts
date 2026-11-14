import { isDesktop } from "./storage";
import { useStore } from "./store";

export interface UpdateInfo { version: string; notes: string }
export type CheckResult =
  | { status: "uptodate" }
  | { status: "available"; info: UpdateInfo }
  | { status: "unavailable"; message: string }
  | { status: "error"; message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pending: any = null;

export async function appVersion(): Promise<string> {
  if (!isDesktop) return "navigateur";
  try {
    return await (await import("@tauri-apps/api/app")).getVersion();
  } catch {
    return "inconnue";
  }
}

/** Cherche une nouvelle version (application de bureau uniquement). */
export async function checkForUpdate(): Promise<CheckResult> {
  if (!isDesktop) return { status: "unavailable", message: "Les mises à jour automatiques fonctionnent dans l'application installée." };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { status: "uptodate" };
    pending = update;
    const info = { version: update.version, notes: update.body ?? "" };
    useStore.setState({ update: info });
    return { status: "available", info };
  } catch (e) {
    const msg = String((e as Error).message ?? e);
    // Version compilée sans clé de mise à jour : le module n'est pas actif.
    if (/not allowed|not found|plugin|pubkey|endpoints|configured/i.test(msg)) {
      return { status: "unavailable", message: "Cette version n'a pas été publiée avec les mises à jour activées (voir docs/RELEASING.md)." };
    }
    return { status: "error", message: msg };
  }
}

/** Télécharge, installe puis redémarre. */
export async function installUpdate(onProgress?: (pct: number) => void): Promise<void> {
  if (!pending) throw new Error("Aucune mise à jour en attente.");
  let total = 0;
  let got = 0;
  await pending.downloadAndInstall((ev: { event: string; data?: { contentLength?: number; chunkLength?: number } }) => {
    if (ev.event === "Started") total = ev.data?.contentLength ?? 0;
    if (ev.event === "Progress") {
      got += ev.data?.chunkLength ?? 0;
      if (total) onProgress?.(Math.round((got / total) * 100));
    }
  });
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("restart_app");
}

const KEY = "plumier-autoupdate";
export const autoUpdateEnabled = () => localStorage.getItem(KEY) !== "0";
export const setAutoUpdate = (v: boolean) => localStorage.setItem(KEY, v ? "1" : "0");
