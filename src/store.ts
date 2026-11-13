import { create } from "zustand";
import type { Project, Section, Status, TreeNode } from "./types";
import { storage, defaultProject, pushRecent, dropRecent } from "./storage";
import { find, findParent, flatten, insert, isDescendant, mapNodes, newNode, remove, sectionOf, today } from "./tree";

export type View = "editor" | "corkboard" | "outline";

interface State {
  dir: string | null;
  project: Project | null;
  section: Section;
  selectedId: string | null;
  view: View;
  focus: boolean;
  dark: boolean;
  toast: string | null;
  saveState: "saved" | "saving" | "error";

  setToast: (m: string | null) => void;
  setView: (v: View) => void;
  setSection: (s: Section) => void;
  toggleFocus: () => void;
  toggleDark: () => void;
  select: (id: string | null) => void;

  createProject: (title: string, author: string) => Promise<void>;
  openProject: (dir?: string) => Promise<void>;
  closeProject: () => void;

  addNode: (kind: TreeNode["kind"], parentId: string | null, section?: Section) => string | undefined;
  updateNode: (id: string, patch: Partial<Pick<TreeNode, "title" | "synopsis" | "status">>) => void;
  deleteNode: (id: string) => Promise<void>;
  moveNode: (id: string, parentId: string | null, index: number) => void;
  updateProject: (patch: Partial<Pick<Project, "title" | "author" | "goals">>) => void;
  /** Appelé par l'éditeur à chaque sauvegarde de scène */
  recordWords: (id: string, words: number) => void;
}

const sectionKey = (s: Section) => s;
let metaTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>((set, get) => {
  /** Applique une modification du projet puis planifie la sauvegarde des métadonnées. */
  const commit = (fn: (p: Project) => Project) => {
    const p = get().project;
    if (!p) return;
    set({ project: fn(p), saveState: "saving" });
    clearTimeout(metaTimer);
    metaTimer = setTimeout(async () => {
      const { dir, project } = get();
      if (!dir || !project) return;
      try {
        await storage.saveMeta(dir, project);
        set({ saveState: "saved" });
      } catch (e) {
        console.error(e);
        set({ saveState: "error", toast: "Échec de la sauvegarde du projet : " + String(e) });
      }
    }, 500);
  };

  const withSection = (p: Project, s: Section, nodes: TreeNode[]): Project => ({ ...p, [sectionKey(s)]: nodes });

  return {
    dir: null,
    project: null,
    section: "manuscript",
    selectedId: null,
    view: "editor",
    focus: false,
    dark: localStorage.getItem("plumier-dark") === "1",
    toast: null,
    saveState: "saved",

    setToast: (toast) => set({ toast }),
    setView: (view) => set({ view }),
    setSection: (section) => set({ section, view: "editor" }),
    toggleFocus: () => set((s) => ({ focus: !s.focus })),
    toggleDark: () =>
      set((s) => {
        localStorage.setItem("plumier-dark", s.dark ? "0" : "1");
        return { dark: !s.dark };
      }),
    select: (selectedId) => {
      if (selectedId) {
        const p = get().project;
        const sec = p && sectionOf(p, selectedId);
        set({ selectedId, ...(sec ? { section: sec } : {}) });
      } else set({ selectedId });
    },

    async createProject(title, author) {
      try {
        const project = defaultProject(title, author);
        const dir = await storage.create(project);
        if (!dir) return;
        pushRecent(dir);
        const first = flatten(project.manuscript).find((n) => n.kind === "doc");
        set({ dir, project, selectedId: first?.id ?? null, section: "manuscript", view: "editor", saveState: "saved" });
      } catch (e) {
        set({ toast: String((e as Error).message ?? e) });
      }
    },

    async openProject(given) {
      try {
        const dir = given ?? (await storage.pick());
        if (!dir) return;
        const project = await storage.load(dir);
        pushRecent(dir);
        const first = flatten(project.manuscript).find((n) => n.kind === "doc");
        set({ dir, project, selectedId: first?.id ?? null, section: "manuscript", view: "editor", saveState: "saved" });
      } catch (e) {
        if (given) dropRecent(given);
        set({ toast: "Impossible d'ouvrir le projet : " + String((e as Error).message ?? e) });
      }
    },

    closeProject: () => set({ dir: null, project: null, selectedId: null }),

    addNode(kind, parentId, section) {
      const p = get().project;
      if (!p) return;
      const sec = section ?? get().section;
      const node = newNode(kind, kind === "folder" ? "Nouveau dossier" : sec === "notes" ? "Nouvelle fiche" : "Nouvelle scène");
      const list = sec === "manuscript" ? p.manuscript : p.notes;
      const parent = parentId ? find(list, parentId) : null;
      const target = parent && parent.kind === "doc" ? findParent(list, parent.id)?.id ?? null : parentId;
      const idx = target ? (find(list, target)?.children.length ?? 0) : list.length;
      commit((pr) => withSection(pr, sec, insert(list, target, idx, node)));
      if (kind === "doc") set({ selectedId: node.id, view: "editor", section: sec });
      return node.id;
    },

    updateNode(id, patch) {
      commit((p) => {
        const sec = sectionOf(p, id);
        if (!sec) return p;
        return withSection(p, sec, mapNodes(p[sec], (n) => (n.id === id ? { ...n, ...patch } : n)));
      });
    },

    async deleteNode(id) {
      const { project, dir } = get();
      if (!project || !dir) return;
      const sec = sectionOf(project, id);
      if (!sec) return;
      const node = find(project[sec], id)!;
      const ids = flatten([node]).map((n) => n.id);
      commit((p) => withSection(p, sec, remove(p[sec], id)));
      await Promise.all(ids.map((i) => storage.deleteDoc(dir, i)));
      if (get().selectedId && ids.includes(get().selectedId!)) {
        const next = flatten(get().project![sec]).find((n) => n.kind === "doc");
        set({ selectedId: next?.id ?? null });
      }
    },

    moveNode(id, parentId, index) {
      commit((p) => {
        const sec = sectionOf(p, id);
        if (!sec) return p;
        const node = find(p[sec], id)!;
        if (parentId === id || (parentId && isDescendant(node, parentId))) return p;
        if (parentId && !find(p[sec], parentId)) return p; // pas de déplacement entre sections
        const parent = parentId ? find(p[sec], parentId) : null;
        if (parent?.kind === "doc") return p;
        // Ajuster l'index si on déplace dans la même liste vers le bas
        const oldParent = findParent(p[sec], id) ?? null;
        const siblings = oldParent ? oldParent.children : p[sec];
        const oldIndex = siblings.findIndex((n) => n.id === id);
        const sameList = (oldParent?.id ?? null) === parentId;
        const adj = sameList && oldIndex < index ? index - 1 : index;
        const without = remove(p[sec], id);
        return withSection(p, sec, insert(without, parentId, adj, node));
      });
    },

    updateProject: (patch) => commit((p) => ({ ...p, ...patch })),

    recordWords(id, words) {
      commit((p) => {
        const sec = sectionOf(p, id);
        if (!sec) return p;
        const old = find(p[sec], id)?.words ?? 0;
        const daily = { ...p.daily };
        if (sec === "manuscript") daily[today()] = Math.max(0, (daily[today()] ?? 0) + (words - old));
        return { ...withSection(p, sec, mapNodes(p[sec], (n) => (n.id === id ? { ...n, words } : n))), daily };
      });
    },
  };
});

export const selectedNode = (s: State): TreeNode | undefined => {
  if (!s.project || !s.selectedId) return undefined;
  return find(s.project.manuscript, s.selectedId) ?? find(s.project.notes, s.selectedId);
};

export type { Status };
