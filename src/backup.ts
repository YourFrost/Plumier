import { zipSync } from "fflate";
import { storage, isDesktop } from "./storage";
import { useStore } from "./store";
import { flushEditor } from "./editorRegistry";

export interface BackupSettings {
  enabled: boolean;
  dir: string;
  /** minutes entre deux sauvegardes */
  intervalMin: number;
  /** nombre d'archives conservées */
  keep: number;
  last: number;
}

const KEY = "plumier-backup";
export const DEFAULT_BACKUP: BackupSettings = { enabled: false, dir: "", intervalMin: 30, keep: 20, last: 0 };

export function loadBackup(): BackupSettings {
  try { return { ...DEFAULT_BACKUP, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return DEFAULT_BACKUP; }
}
export function saveBackup(s: BackupSettings) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim() || "Projet";
const z = (n: number) => String(n).padStart(2, "0");
const stampNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}_${z(d.getHours())}h${z(d.getMinutes())}`;
};

let running = false;
/** Crée une archive .zip datée du projet. `manual` : demande un dossier si aucun n'est défini. */
export async function runBackup(manual = false): Promise<boolean> {
  const { dir, project, setToast } = useStore.getState();
  if (!dir || !project || running) return false;
  const cfg = loadBackup();
  if (!manual && (!cfg.enabled || !cfg.dir)) return false;
  running = true;
  try {
    let dest = cfg.dir;
    if (!dest && isDesktop) {
      const picked = await storage.pickFolder("Dossier des sauvegardes");
      if (!picked) return false;
      dest = picked;
      saveBackup({ ...cfg, dir: picked });
    }
    await flushEditor();
    await storage.saveMeta(dir, project);
    const files = await storage.collectFiles(dir);
    const base = safe(project.title);
    const tree: Record<string, Uint8Array> = {};
    for (const [k, v] of Object.entries(files)) tree[`${base}/${k}`] = v;
    const data = zipSync(tree, { level: 6 });
    const where = await storage.writeBackup(dest, `${base}_${stampNow()}.zip`, data);
    await storage.pruneBackups(dest, base, loadBackup().keep);
    saveBackup({ ...loadBackup(), last: Date.now() });
    dirty = false;
    if (manual) setToast("Sauvegarde créée : " + where);
    return true;
  } catch (e) {
    console.error(e);
    setToast("Échec de la sauvegarde : " + String((e as Error).message ?? e));
    return false;
  } finally {
    running = false;
  }
}

/* --- Planificateur : tourne tant que l'application est ouverte --- */
let dirty = false;
let timer: ReturnType<typeof setInterval> | undefined;

export function startBackupScheduler() {
  // le projet a-t-il changé depuis la dernière sauvegarde ?
  const unsub = useStore.subscribe((s, prev) => {
    if (s.dir !== prev.dir) dirty = false;
    else if (s.project !== prev.project && s.project) dirty = true;
  });
  timer = setInterval(() => {
    const cfg = loadBackup();
    if (!cfg.enabled || !cfg.dir || !dirty) return;
    if (Date.now() - cfg.last >= cfg.intervalMin * 60_000) void runBackup(false);
  }, 30_000);
  return () => {
    unsub();
    clearInterval(timer);
  };
}
