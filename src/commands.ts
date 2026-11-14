import { useStore } from "./store";
import { activeEditor, flushEditor } from "./editorRegistry";
import { flatten } from "./tree";
import { storage } from "./storage";

export interface Command {
  id: string;
  label: string;
  group: string;
  /** Raccourci par défaut ("Ctrl+Shift+F") */
  keys?: string;
  run: () => void | Promise<void>;
}

const st = () => useStore.getState();

/** Scène suivante / précédente dans l'ordre du manuscrit. */
function stepScene(dir: 1 | -1) {
  const s = st();
  if (!s.project) return;
  const docs = flatten(s.project.manuscript).filter((n) => n.kind === "doc");
  const i = docs.findIndex((n) => n.id === s.selectedId);
  const next = docs[Math.min(docs.length - 1, Math.max(0, (i < 0 ? 0 : i) + dir))];
  if (next) { s.setView("editor"); s.select(next.id); }
}

function stepTab(dir: 1 | -1) {
  const s = st();
  if (s.tabs.length < 2) return;
  const i = s.tabs.indexOf(s.selectedId ?? "");
  s.select(s.tabs[(i + dir + s.tabs.length) % s.tabs.length]);
}

const panel = (tab: "proof" | "repeat" | "notes") => () => {
  const s = st();
  s.setView("editor");
  s.setSidePanel(s.activePane, s.sidePanel[s.activePane] === tab ? null : tab);
};

export const COMMANDS: Command[] = [
  // Général
  { id: "palette", label: "Palette de commandes", group: "Général", keys: "Ctrl+K", run: () => st().setModal("palette") },
  { id: "quickopen", label: "Ouvrir une scène ou une fiche…", group: "Général", keys: "Ctrl+P", run: () => st().setModal("quickopen") },
  { id: "search", label: "Rechercher dans le projet", group: "Général", keys: "Ctrl+Shift+F", run: () => st().setModal("search") },
  { id: "save", label: "Enregistrer maintenant", group: "Général", keys: "Ctrl+S", run: async () => { await flushEditor(); const { dir, project } = st(); if (dir && project) await storage.saveMeta(dir, project); useStore.setState({ saveState: "saved", toast: "Projet enregistré." }); } },
  { id: "settings", label: "Réglages…", group: "Général", keys: "Ctrl+,", run: () => st().setModal("settings") },
  { id: "export", label: "Exporter le livre…", group: "Général", keys: "Ctrl+E", run: () => st().setModal("export") },
  { id: "import", label: "Importer des fichiers (.docx, .md)…", group: "Général", keys: "Ctrl+Shift+O", run: () => st().setModal("import") },
  { id: "templates", label: "Modèles de structure…", group: "Général", run: () => st().setModal("templates") },
  { id: "dark", label: "Basculer thème clair / sombre", group: "Général", keys: "Ctrl+Alt+L", run: () => st().toggleDark() },
  { id: "focus", label: "Mode focus", group: "Général", keys: "F11", run: () => st().toggleFocus() },
  { id: "binder", label: "Afficher / masquer le classeur", group: "Général", keys: "Ctrl+Shift+B", run: () => st().toggleBinder() },
  { id: "inspector", label: "Afficher / masquer le panneau de détails", group: "Général", keys: "Ctrl+Shift+J", run: () => st().toggleInspector() },
  { id: "close", label: "Fermer le projet", group: "Général", run: async () => { await flushEditor(); st().closeProject(); } },
  // Projet
  { id: "newScene", label: "Nouvelle scène / fiche", group: "Projet", keys: "Ctrl+N", run: () => { const s = st(); s.addNode("doc", null); } },
  { id: "newFolder", label: "Nouveau dossier", group: "Projet", keys: "Ctrl+Shift+N", run: () => { st().addNode("folder", null); } },
  { id: "snapshot", label: "Prendre un instantané de la scène", group: "Projet", keys: "Ctrl+Shift+S", run: async () => { const s = st(); const id = s.selectedId; if (!s.dir || !id) return; await flushEditor(); await storage.saveSnapshot(s.dir, id, await storage.readDoc(s.dir, id)); s.setToast("Instantané enregistré."); } },
  { id: "backup", label: "Sauvegarder maintenant (archive .zip)", group: "Projet", keys: "Ctrl+Alt+S", run: async () => { const { runBackup } = await import("./backup"); await runBackup(true); } },
  // Navigation
  { id: "nextScene", label: "Scène suivante", group: "Navigation", keys: "Alt+Down", run: () => stepScene(1) },
  { id: "prevScene", label: "Scène précédente", group: "Navigation", keys: "Alt+Up", run: () => stepScene(-1) },
  { id: "nextTab", label: "Onglet suivant", group: "Navigation", keys: "Ctrl+Tab", run: () => stepTab(1) },
  { id: "prevTab", label: "Onglet précédent", group: "Navigation", keys: "Ctrl+Shift+Tab", run: () => stepTab(-1) },
  { id: "closeTab", label: "Fermer l'onglet", group: "Navigation", keys: "Ctrl+W", run: () => { const id = st().selectedId; if (id) st().closeTab(id); } },
  { id: "split", label: "Scinder / réunir les volets", group: "Navigation", keys: "Ctrl+Alt+D", run: () => st().setSplit(!st().split) },
  { id: "pane", label: "Passer d'un volet à l'autre", group: "Navigation", keys: "Ctrl+Alt+Right", run: () => { const s = st(); if (s.split) s.setActivePane(s.activePane === 0 ? 1 : 0); } },
  // Vues
  { id: "vEditor", label: "Vue Écriture", group: "Vues", keys: "Ctrl+1", run: () => st().setView("editor") },
  { id: "vCork", label: "Vue Tableau de liège", group: "Vues", keys: "Ctrl+2", run: () => st().setView("corkboard") },
  { id: "vOutline", label: "Vue Plan", group: "Vues", keys: "Ctrl+3", run: () => st().setView("outline") },
  { id: "vTimeline", label: "Vue Chronologie", group: "Vues", keys: "Ctrl+4", run: () => st().setView("timeline") },
  { id: "vMatrix", label: "Vue Présence (personnages × scènes)", group: "Vues", keys: "Ctrl+5", run: () => st().setView("matrix") },
  { id: "vRelations", label: "Vue Relations", group: "Vues", keys: "Ctrl+6", run: () => st().setView("relations") },
  { id: "vStats", label: "Vue Statistiques", group: "Vues", keys: "Ctrl+7", run: () => st().setView("stats") },
  // Écriture
  { id: "proof", label: "Correction grammaticale", group: "Écriture", keys: "F7", run: panel("proof") },
  { id: "repeat", label: "Vérifier les répétitions", group: "Écriture", keys: "F8", run: panel("repeat") },
  { id: "notes", label: "Notes et commentaires", group: "Écriture", keys: "F9", run: panel("notes") },
  { id: "footnote", label: "Insérer une note de bas de page", group: "Écriture", keys: "Ctrl+Alt+F", run: () => { const e = activeEditor(); if (!e) return; e.chain().focus().insertContent({ type: "footnote", attrs: { text: "" } }).run(); const s = st(); s.setSidePanel(s.activePane, "notes"); } },
  { id: "comment", label: "Commenter la sélection", group: "Écriture", keys: "Ctrl+Alt+M", run: () => { const e = activeEditor(); if (!e) return; if (e.state.selection.empty) return st().setToast("Sélectionne d'abord un passage à commenter."); e.chain().focus().setMark("comment", { text: "" }).run(); const s = st(); s.setSidePanel(s.activePane, "notes"); } },
  { id: "typewriter", label: "Mode machine à écrire", group: "Écriture", keys: "Ctrl+Alt+T", run: () => st().toggleTypewriter() },
  { id: "hr", label: "Insérer un séparateur de scène (* * *)", group: "Écriture", keys: "Ctrl+Alt+H", run: () => { activeEditor()?.chain().focus().setHorizontalRule().run(); } },
];

/* ----------------------------- Raccourcis ----------------------------- */
const KEY = "plumier-keys";
export type Bindings = Record<string, string>;

export function loadBindings(): Bindings {
  try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; }
}
export function saveBindings(b: Bindings) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* ignore */ }
}
/** Raccourci effectif d'une commande ("" = désactivé). */
export const keysOf = (c: Command, b: Bindings = loadBindings()) => (c.id in b ? b[c.id] : (c.keys ?? ""));

const NAMES: Record<string, string> = { ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right", " ": "Space", Escape: "Esc" };

/** Transforme un évènement clavier en "Ctrl+Shift+F". Retourne "" pour une touche de modification seule. */
export function eventToKeys(e: KeyboardEvent): string {
  if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return "";
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  let k = NAMES[e.key] ?? e.key;
  // chiffres de la rangée AZERTY (qui produisent des symboles sans Maj) : on se fie au code physique
  if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
  else if (/^Key[A-Z]$/.test(e.code) && (e.ctrlKey || e.altKey)) k = e.code.slice(3);
  else if (k.length === 1) k = k.toUpperCase();
  parts.push(k);
  return parts.join("+");
}

export function findCommand(keys: string): Command | undefined {
  const b = loadBindings();
  return COMMANDS.find((c) => keysOf(c, b) === keys);
}

/** Écriture lisible : "Ctrl+Alt+Right" → "Ctrl + Alt + →". */
export const prettyKeys = (k: string) =>
  k.split("+").map((x) => ({ Up: "↑", Down: "↓", Left: "←", Right: "→", Esc: "Échap" } as Record<string, string>)[x] ?? x).join(" + ");
