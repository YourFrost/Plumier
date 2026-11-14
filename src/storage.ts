import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readDir, readFile, readTextFile, remove, rename, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Project, SnapshotInfo } from "./types";
import { DEFAULT_LABELS, newNode, normalizeProject } from "./tree";

/**
 * Format d'un projet sur disque :
 *   <dossier>/plumier.json              métadonnées + arbre
 *   <dossier>/content/<id>.md           texte de chaque scène / fiche
 *   <dossier>/snapshots/<id>/<date>.md  instantanés
 * Tout est lisible avec n'importe quel éditeur de texte.
 */

export const isDesktop = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type ExportFormat = "docx" | "epub" | "odt" | "html" | "md";

export function defaultProject(title: string, author = ""): Project {
  const chapter = newNode("folder", "Chapitre 1");
  chapter.children.push(newNode("doc", "Scène 1"));
  return {
    version: 1,
    title,
    author,
    manuscript: [chapter],
    notes: ["Personnages", "Lieux", "Univers", "Recherches"].map((t) => newNode("folder", t)),
    goals: { total: 80000, daily: 500, deadline: "" },
    labels: DEFAULT_LABELS,
    dictionary: [],
    ignoredRepeats: [],
    daily: {},
  };
}

const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim() || "Projet";
const stamp = () => new Date().toISOString().slice(0, 19).replace(/:/g, "-");
const labelOf = (name: string) => {
  const [d, t = ""] = name.split("T");
  return `${d.split("-").reverse().join("/")} à ${t.replace(/-/g, ":")}`;
};

export interface StorageApi {
  /** Demande où créer le projet (null = annulé). Retourne l'identifiant du projet. */
  create(project: Project): Promise<string | null>;
  /** Demande quel projet ouvrir (null = annulé). */
  pick(): Promise<string | null>;
  load(dir: string): Promise<Project>;
  saveMeta(dir: string, p: Project): Promise<void>;
  readDoc(dir: string, id: string): Promise<string>;
  writeDoc(dir: string, id: string, md: string): Promise<void>;
  deleteDoc(dir: string, id: string): Promise<void>;
  listSnapshots(dir: string, id: string): Promise<SnapshotInfo[]>;
  saveSnapshot(dir: string, id: string, md: string): Promise<void>;
  readSnapshot(dir: string, id: string, name: string): Promise<string>;
  exportBook(dir: string, md: string, title: string, author: string, fmt: ExportFormat): Promise<string | null>;
  /** Tous les fichiers du projet (chemin relatif → contenu), pour les sauvegardes. */
  collectFiles(dir: string): Promise<Record<string, Uint8Array>>;
  pickFolder(title: string): Promise<string | null>;
  /** Écrit une archive de sauvegarde ; retourne l'emplacement. */
  writeBackup(destDir: string, name: string, data: Uint8Array): Promise<string>;
  /** Supprime les plus anciennes archives `<prefix>_*.zip` au-delà de `keep`. */
  pruneBackups(destDir: string, prefix: string, keep: number): Promise<void>;
  /** Choisit des fichiers à importer (.docx binaire, .md/.txt texte). */
  pickImportFiles(): Promise<{ name: string; bytes?: Uint8Array; text?: string }[]>;
}

/* ------------------------------------------------------------------ */
/* Version bureau (Tauri) : fichiers réels                             */
/* ------------------------------------------------------------------ */
const desktop: StorageApi = {
  async create(project) {
    const parent = await openDialog({ directory: true, title: "Où créer le projet ?" });
    if (typeof parent !== "string") return null;
    const dir = await join(parent, sanitize(project.title));
    if (await exists(await join(dir, "plumier.json"))) throw new Error("Un projet existe déjà à cet endroit.");
    await mkdir(await join(dir, "content"), { recursive: true });
    await mkdir(await join(dir, "snapshots"), { recursive: true });
    await this.saveMeta(dir, project);
    return dir;
  },
  async pick() {
    const dir = await openDialog({ directory: true, title: "Ouvrir un projet Plumier" });
    return typeof dir === "string" ? dir : null;
  },
  async load(dir) {
    const file = await join(dir, "plumier.json");
    if (!(await exists(file))) throw new Error("Ce dossier ne contient pas de projet Plumier.");
    return normalizeProject(JSON.parse(await readTextFile(file)));
  },
  async saveMeta(dir, p) {
    const file = await join(dir, "plumier.json");
    const tmp = file + ".tmp";
    await writeTextFile(tmp, JSON.stringify(p, null, 2));
    await rename(tmp, file);
  },
  async readDoc(dir, id) {
    const f = await join(dir, "content", id + ".md");
    return (await exists(f)) ? readTextFile(f) : "";
  },
  async writeDoc(dir, id, md) {
    await mkdir(await join(dir, "content"), { recursive: true });
    await writeTextFile(await join(dir, "content", id + ".md"), md);
  },
  async deleteDoc(dir, id) {
    const f = await join(dir, "content", id + ".md");
    if (await exists(f)) await remove(f);
    const s = await join(dir, "snapshots", id);
    if (await exists(s)) await remove(s, { recursive: true });
  },
  async listSnapshots(dir, id) {
    const d = await join(dir, "snapshots", id);
    if (!(await exists(d))) return [];
    const entries = await readDir(d);
    return entries
      .filter((e) => e.name.endsWith(".md"))
      .map((e) => e.name.slice(0, -3))
      .sort()
      .reverse()
      .map((name) => ({ name, label: labelOf(name) }));
  },
  async saveSnapshot(dir, id, md) {
    const d = await join(dir, "snapshots", id);
    await mkdir(d, { recursive: true });
    await writeTextFile(await join(d, stamp() + ".md"), md);
  },
  readSnapshot: async (dir, id, name) => readTextFile(await join(dir, "snapshots", id, name + ".md")),
  async exportBook(dir, md, title, author, fmt) {
    const out = await saveDialog({
      title: "Exporter le livre",
      defaultPath: `${sanitize(title)}.${fmt}`,
      filters: [{ name: fmt.toUpperCase(), extensions: [fmt] }],
    });
    if (!out) return null;
    if (fmt === "md") {
      await writeTextFile(out, md);
      return out;
    }
    const tmp = await join(dir, ".export.md");
    await writeTextFile(tmp, md);
    try {
      const args = [tmp, "-f", "markdown+smart", "-o", out, "--metadata", `title=${title}`, "--metadata", "lang=fr-FR"];
      if (author) args.push("--metadata", `author=${author}`);
      if (fmt === "html") args.push("--standalone");
      await invoke("run_pandoc", { args });
    } finally {
      if (await exists(tmp)) await remove(tmp);
    }
    return out;
  },
  async collectFiles(dir) {
    const out: Record<string, Uint8Array> = {};
    const walk = async (rel: string) => {
      const abs = rel ? await join(dir, rel) : dir;
      for (const e of await readDir(abs)) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory) await walk(r);
        else if (!e.name.endsWith(".tmp") && e.name !== ".export.md") out[r] = await readFile(await join(dir, r));
      }
    };
    await walk("");
    return out;
  },
  async pickFolder(title) {
    const d = await openDialog({ directory: true, title });
    return typeof d === "string" ? d : null;
  },
  async writeBackup(destDir, name, data) {
    await mkdir(destDir, { recursive: true });
    const f = await join(destDir, name);
    await writeFile(f, data);
    return f;
  },
  async pruneBackups(destDir, prefix, keep) {
    if (!(await exists(destDir))) return;
    const files = (await readDir(destDir)).map((e) => e.name).filter((n) => n.startsWith(prefix + "_") && n.endsWith(".zip")).sort();
    for (const n of files.slice(0, Math.max(0, files.length - keep))) await remove(await join(destDir, n));
  },
  async pickImportFiles() {
    const sel = await openDialog({
      multiple: true,
      title: "Importer des documents",
      filters: [{ name: "Documents", extensions: ["docx", "md", "markdown", "txt"] }],
    });
    const paths = Array.isArray(sel) ? sel : sel ? [sel] : [];
    const out: { name: string; bytes?: Uint8Array; text?: string }[] = [];
    for (const f of paths) {
      const name = f.split(/[\\/]/).pop() ?? f;
      if (/\.docx$/i.test(name)) out.push({ name, bytes: await readFile(f) });
      else out.push({ name, text: await readTextFile(f) });
    }
    return out;
  },
};

/* ------------------------------------------------------------------ */
/* Version navigateur (développement / tests) : localStorage           */
/* ------------------------------------------------------------------ */
const ls = {
  get: (k: string) => localStorage.getItem("plumier:" + k),
  set: (k: string, v: string) => localStorage.setItem("plumier:" + k, v),
  del: (k: string) => localStorage.removeItem("plumier:" + k),
  keys: (prefix: string) =>
    Object.keys(localStorage)
      .filter((k) => k.startsWith("plumier:" + prefix))
      .map((k) => k.slice("plumier:".length)),
};

const web: StorageApi = {
  async create(project) {
    const dir = sanitize(project.title);
    await this.saveMeta(dir, project);
    return dir;
  },
  async pick() {
    const projects = ls.keys("meta:").map((k) => k.slice(5));
    if (!projects.length) return null;
    return prompt("Projets disponibles :\n" + projects.join("\n") + "\n\nNom du projet à ouvrir :", projects[0]);
  },
  async load(dir) {
    const raw = ls.get("meta:" + dir);
    if (!raw) throw new Error("Projet introuvable.");
    return normalizeProject(JSON.parse(raw));
  },
  saveMeta: async (dir, p) => ls.set("meta:" + dir, JSON.stringify(p)),
  readDoc: async (dir, id) => ls.get(`doc:${dir}:${id}`) ?? "",
  writeDoc: async (dir, id, md) => ls.set(`doc:${dir}:${id}`, md),
  async deleteDoc(dir, id) {
    ls.del(`doc:${dir}:${id}`);
    ls.keys(`snap:${dir}:${id}:`).forEach((k) => localStorage.removeItem("plumier:" + k));
  },
  async listSnapshots(dir, id) {
    return ls
      .keys(`snap:${dir}:${id}:`)
      .map((k) => k.split(":").pop()!)
      .sort()
      .reverse()
      .map((name) => ({ name, label: labelOf(name) }));
  },
  saveSnapshot: async (dir, id, md) => ls.set(`snap:${dir}:${id}:${stamp()}`, md),
  readSnapshot: async (dir, id, name) => ls.get(`snap:${dir}:${id}:${name}`) ?? "",
  async exportBook(_dir, md, title) {
    const url = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = sanitize(title) + ".md";
    a.click();
    URL.revokeObjectURL(url);
    return a.download;
  },
  async collectFiles(dir) {
    const out: Record<string, Uint8Array> = {};
    const enc = new TextEncoder();
    const meta = ls.get("meta:" + dir);
    if (meta) out["plumier.json"] = enc.encode(meta);
    for (const k of ls.keys(`doc:${dir}:`)) out[`content/${k.split(":").pop()}.md`] = enc.encode(localStorage.getItem("plumier:" + k) ?? "");
    for (const k of ls.keys(`snap:${dir}:`)) {
      const [, , id, name] = k.split(":");
      out[`snapshots/${id}/${name}.md`] = enc.encode(localStorage.getItem("plumier:" + k) ?? "");
    }
    return out;
  },
  pickFolder: async () => "navigateur",
  async writeBackup(_d, name, data) {
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return name;
  },
  pruneBackups: async () => {},
  pickImportFiles: () =>
    new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".docx,.md,.markdown,.txt";
      input.onchange = async () => {
        const out: { name: string; bytes?: Uint8Array; text?: string }[] = [];
        for (const f of Array.from(input.files ?? [])) {
          if (/\.docx$/i.test(f.name)) out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
          else out.push({ name: f.name, text: await f.text() });
        }
        resolve(out);
      };
      input.click();
    }),
};

export const storage: StorageApi = isDesktop ? desktop : web;

/* Projets récents (commun aux deux versions) */
export function recentProjects(): string[] {
  try {
    return JSON.parse(localStorage.getItem("plumier-recent") ?? "[]");
  } catch {
    return [];
  }
}
export function pushRecent(dir: string) {
  const list = [dir, ...recentProjects().filter((d) => d !== dir)].slice(0, 8);
  localStorage.setItem("plumier-recent", JSON.stringify(list));
}
export function dropRecent(dir: string) {
  localStorage.setItem("plumier-recent", JSON.stringify(recentProjects().filter((d) => d !== dir)));
}
