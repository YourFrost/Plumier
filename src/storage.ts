import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Project, SnapshotInfo } from "./types";
import { newNode } from "./tree";

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
    goals: { total: 80000, daily: 500 },
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
    return JSON.parse(await readTextFile(file));
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
    return JSON.parse(raw);
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
