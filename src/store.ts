import { create } from "zustand";
import type { Project, Section, Status, TreeNode } from "./types";
import { storage, defaultProject, pushRecent, dropRecent } from "./storage";
import { DEFAULT_PREFS, loadPrefs, savePrefs, type Prefs, THEMES } from "./prefs";
import { find, findParent, flatten, insert, isDescendant, mapNodes, newNode, remove, sectionOf, today } from "./tree";

export type View = "editor" | "corkboard" | "outline" | "timeline" | "matrix" | "relations" | "stats";
export type Modal = null | "settings" | "export" | "import" | "search" | "palette" | "quickopen" | "templates";
export type PanelTab = "proof" | "repeat" | "notes";

interface State {
  dir: string | null;
  project: Project | null;
  section: Section;
  /** Document actif (celui du volet actif) ou dossier sélectionné */
  selectedId: string | null;
  /** Onglets ouverts (ids de documents) */
  tabs: string[];
  /** Document affiché dans chacun des deux volets */
  paneIds: [string | null, string | null];
  split: boolean;
  activePane: 0 | 1;
  sidePanel: [PanelTab | null, PanelTab | null];
  view: View;
  focus: boolean;
  theme: string;
  prefs: Prefs;
  showBinder: boolean;
  showInspector: boolean;
  typewriter: boolean;
  modal: Modal;
  toast: string | null;
  saveState: "saved" | "saving" | "error";
  /** Suivi de la session d'écriture */
  sessionStart: number;
  sessionWords: number;
  selWords: number;
  /** Mise à jour disponible (annoncée dans la barre d'état) */
  update: { version: string; notes: string } | null;

  setToast: (m: string | null) => void;
  setView: (v: View) => void;
  setModal: (m: Modal) => void;
  setSection: (s: Section) => void;
  toggleFocus: () => void;
  toggleDark: () => void;
  setTheme: (t: string) => void;
  setPrefs: (p: Partial<Prefs>) => void;
  toggleBinder: () => void;
  toggleInspector: () => void;
  toggleTypewriter: () => void;
  select: (id: string | null) => void;
  closeTab: (id: string) => void;
  setSplit: (on: boolean) => void;
  setActivePane: (i: 0 | 1) => void;
  setSidePanel: (pane: 0 | 1, tab: PanelTab | null) => void;

  createProject: (title: string, author: string) => Promise<void>;
  openProject: (dir?: string) => Promise<void>;
  closeProject: () => void;

  addNode: (kind: TreeNode["kind"], parentId: string | null, section?: Section) => string | undefined;
  updateNode: (id: string, patch: Partial<Omit<TreeNode, "id" | "kind" | "children" | "words">>) => void;
  deleteNode: (id: string) => Promise<void>;
  moveNode: (id: string, parentId: string | null, index: number) => void;
  updateProject: (patch: Partial<Pick<Project, "title" | "author" | "goals" | "labels" | "dictionary" | "ignoredRepeats">>) => void;
  deleteLabel: (id: string) => void;
  /** Remplace les arbres (import, modèles de structure) */
  replaceTrees: (patch: Partial<Pick<Project, "manuscript" | "notes">>) => void;
  /** Appelé par l'éditeur à chaque sauvegarde de scène */
  recordWords: (id: string, words: number) => void;
}

let metaTimer: ReturnType<typeof setTimeout> | undefined;

const openingState = (project: Project) => {
  const first = flatten(project.manuscript).find((n) => n.kind === "doc");
  return {
    project,
    selectedId: first?.id ?? null,
    tabs: first ? [first.id] : [],
    paneIds: [first?.id ?? null, null] as [string | null, string | null],
    split: false,
    activePane: 0 as const,
    sidePanel: [null, null] as [PanelTab | null, PanelTab | null],
    section: "manuscript" as Section,
    view: "editor" as View,
    saveState: "saved" as const,
    sessionStart: Date.now(),
    sessionWords: 0,
    modal: null,
  };
};

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

  const withSection = (p: Project, s: Section, nodes: TreeNode[]): Project => ({ ...p, [s]: nodes });

  return {
    dir: null,
    project: null,
    section: "manuscript",
    selectedId: null,
    tabs: [],
    paneIds: [null, null],
    split: false,
    activePane: 0,
    sidePanel: [null, null],
    view: "editor",
    focus: false,
    theme: localStorage.getItem("plumier-theme") ?? (localStorage.getItem("plumier-dark") === "1" ? "nuit" : "parchemin"),
    prefs: loadPrefs(),
    showBinder: true,
    showInspector: true,
    typewriter: localStorage.getItem("plumier-typewriter") === "1",
    modal: null,
    toast: null,
    saveState: "saved",
    sessionStart: Date.now(),
    sessionWords: 0,
    selWords: 0,
    update: null,

    setToast: (toast) => set({ toast }),
    setView: (view) => set({ view }),
    setModal: (modal) => set({ modal }),
    setSection: (section) => set({ section, view: "editor" }),
    toggleFocus: () => set((s) => ({ focus: !s.focus })),
    toggleDark: () =>
      set((s) => {
        const dark = THEMES.find((t) => t.id === s.theme)?.dark;
        const theme = dark ? "parchemin" : "nuit";
        localStorage.setItem("plumier-theme", theme);
        return { theme };
      }),
    setTheme: (theme) => {
      localStorage.setItem("plumier-theme", theme);
      set({ theme });
    },
    setPrefs: (patch) =>
      set((s) => {
        const prefs = { ...s.prefs, ...patch };
        savePrefs(prefs);
        return { prefs };
      }),
    toggleBinder: () => set((s) => ({ showBinder: !s.showBinder })),
    toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
    toggleTypewriter: () =>
      set((s) => {
        localStorage.setItem("plumier-typewriter", s.typewriter ? "0" : "1");
        return { typewriter: !s.typewriter };
      }),

    select(id) {
      if (!id) return set({ selectedId: null });
      const s = get();
      const p = s.project;
      if (!p) return;
      const sec = sectionOf(p, id);
      const node = find(p.manuscript, id) ?? find(p.notes, id);
      if (!node) return;
      if (node.kind === "folder") return set({ selectedId: id, ...(sec ? { section: sec } : {}) });
      // Un document déjà ouvert dans l'autre volet : on active ce volet.
      const ids = [...s.paneIds] as [string | null, string | null];
      let pane = s.activePane;
      const existing = ids.indexOf(id);
      if (existing >= 0 && s.split) pane = existing as 0 | 1;
      else ids[pane] = id;
      set({
        paneIds: ids,
        activePane: pane,
        selectedId: id,
        tabs: s.tabs.includes(id) ? s.tabs : [...s.tabs, id],
        ...(sec ? { section: sec } : {}),
      });
    },

    closeTab(id) {
      const s = get();
      const tabs = s.tabs.filter((t) => t !== id);
      const ids = [...s.paneIds] as [string | null, string | null];
      ([0, 1] as const).forEach((i) => {
        if (ids[i] === id) {
          const other = ids[1 - i];
          ids[i] = tabs.filter((t) => t !== other).slice(-1)[0] ?? null;
        }
      });
      set({ tabs, paneIds: ids, selectedId: ids[s.activePane] ?? s.selectedId });
    },

    setSplit(on) {
      const s = get();
      if (on) {
        const ids = [...s.paneIds] as [string | null, string | null];
        if (!ids[1] || ids[1] === ids[0]) ids[1] = s.tabs.filter((t) => t !== ids[0]).slice(-1)[0] ?? null;
        set({ split: true, paneIds: ids });
      } else {
        set({ split: false, activePane: 0, selectedId: s.paneIds[0] ?? s.selectedId });
      }
    },

    setActivePane(i) {
      const s = get();
      if (s.activePane === i) return;
      set({ activePane: i, selectedId: s.paneIds[i] ?? s.selectedId });
    },

    setSidePanel(pane, tab) {
      const sp = [...get().sidePanel] as [PanelTab | null, PanelTab | null];
      sp[pane] = tab;
      set({ sidePanel: sp });
    },

    async createProject(title, author) {
      try {
        const project = defaultProject(title, author);
        const dir = await storage.create(project);
        if (!dir) return;
        pushRecent(dir);
        set({ dir, ...openingState(project) });
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
        set({ dir, ...openingState(project) });
      } catch (e) {
        if (given) dropRecent(given);
        set({ toast: "Impossible d'ouvrir le projet : " + String((e as Error).message ?? e) });
      }
    },

    closeProject: () => set({ dir: null, project: null, selectedId: null, tabs: [], paneIds: [null, null], modal: null }),

    addNode(kind, parentId, section) {
      const p = get().project;
      if (!p) return;
      const sec = section ?? get().section;
      const node = newNode(kind, kind === "folder" ? "Nouveau dossier" : sec === "notes" ? "Nouvelle fiche" : "Nouvelle scène");
      const list = sec === "manuscript" ? p.manuscript : p.notes;
      const parent = parentId ? find(list, parentId) : null;
      const target = parent && parent.kind === "doc" ? (findParent(list, parent.id)?.id ?? null) : parentId;
      const idx = target ? (find(list, target)?.children.length ?? 0) : list.length;
      commit((pr) => withSection(pr, sec, insert(list, target, idx, node)));
      if (kind === "doc") {
        set({ view: "editor", section: sec });
        get().select(node.id);
      }
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
      ids.forEach((i) => get().closeTab(i));
      const s = get();
      if (s.selectedId && ids.includes(s.selectedId)) {
        const next = flatten(s.project![sec]).find((n) => n.kind === "doc");
        if (next) get().select(next.id);
        else set({ selectedId: null });
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
        const oldParent = findParent(p[sec], id) ?? null;
        const siblings = oldParent ? oldParent.children : p[sec];
        const oldIndex = siblings.findIndex((n) => n.id === id);
        const sameList = (oldParent?.id ?? null) === parentId;
        const adj = sameList && oldIndex < index ? index - 1 : index;
        return withSection(p, sec, insert(remove(p[sec], id), parentId, adj, node));
      });
    },

    updateProject: (patch) => commit((p) => ({ ...p, ...patch })),

    deleteLabel: (id) =>
      commit((p) => ({
        ...p,
        labels: p.labels.filter((l) => l.id !== id),
        manuscript: mapNodes(p.manuscript, (n) => ({ ...n, labels: n.labels.filter((l) => l !== id) })),
        notes: mapNodes(p.notes, (n) => ({ ...n, labels: n.labels.filter((l) => l !== id) })),
      })),

    replaceTrees: (patch) => commit((p) => ({ ...p, ...patch })),

    recordWords(id, words) {
      const before = get().project;
      const sec = before && sectionOf(before, id);
      const old = (before && sec && find(before[sec], id)?.words) ?? 0;
      commit((p) => {
        const s = sectionOf(p, id);
        if (!s) return p;
        const daily = { ...p.daily };
        if (s === "manuscript") daily[today()] = Math.max(0, (daily[today()] ?? 0) + (words - old));
        return { ...withSection(p, s, mapNodes(p[s], (n) => (n.id === id ? { ...n, words } : n))), daily };
      });
      if (sec === "manuscript" && words !== old) set((s) => ({ sessionWords: s.sessionWords + (words - old) }));
    },
  };
});

export const nodeById = (s: Pick<State, "project">, id: string | null): TreeNode | undefined => {
  if (!s.project || !id) return undefined;
  return find(s.project.manuscript, id) ?? find(s.project.notes, id);
};

export const selectedNode = (s: State): TreeNode | undefined => nodeById(s, s.selectedId);

export { DEFAULT_PREFS };
export type { Status };
