import { useEffect } from "react";
import { useStore, type View } from "./store";
import { Binder } from "./components/Binder";
import { EditorArea } from "./components/EditorArea";
import { Corkboard } from "./components/Corkboard";
import { Outline } from "./components/Outline";
import { Timeline } from "./components/Timeline";
import { Stats } from "./components/Stats";
import { Matrix } from "./components/Matrix";
import { Relations } from "./components/Relations";
import { TemplatesDialog } from "./components/TemplatesDialog";
import { Inspector } from "./components/Inspector";
import { Welcome } from "./components/Welcome";
import { ExportDialog } from "./components/ExportDialog";
import { SearchDialog } from "./components/SearchDialog";
import { Palette } from "./components/Palette";
import { SettingsDialog } from "./components/SettingsDialog";
import { ImportDialog } from "./components/ImportDialog";
import { StatusBar } from "./components/StatusBar";
import { flushEditor } from "./editorRegistry";
import { COMMANDS, eventToKeys, findCommand } from "./commands";
import { startBackupScheduler, loadBackup, runBackup } from "./backup";
import { autoUpdateEnabled, checkForUpdate } from "./updater";
import { isDesktop } from "./storage";

const VIEWS: { v: View; label: string; tip: string }[] = [
  { v: "editor", label: "✍ Écriture", tip: "Ctrl+1" },
  { v: "corkboard", label: "🗂 Tableau", tip: "Ctrl+2" },
  { v: "outline", label: "☰ Plan", tip: "Ctrl+3" },
  { v: "timeline", label: "⏱ Chronologie", tip: "Ctrl+4" },
  { v: "matrix", label: "▦ Présence", tip: "Ctrl+5" },
  { v: "relations", label: "🕸 Relations", tip: "Ctrl+6" },
  { v: "stats", label: "📊 Stats", tip: "Ctrl+7" },
];

export function App() {
  const s = useStore();
  const { project, view, setView, focus, toast, setToast, modal, setModal, theme, prefs } = s;

  // Thème et typographie de l'éditeur
  useEffect(() => {
    const r = document.documentElement;
    r.dataset.theme = theme;
    r.style.setProperty("--ed-font", prefs.font);
    r.style.setProperty("--ed-size", prefs.size + "px");
    r.style.setProperty("--ed-line", String(prefs.line));
    r.style.setProperty("--page-width", prefs.width + "px");
  }, [theme, prefs]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  // Raccourcis clavier globaux (personnalisables)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && useStore.getState().focus) { useStore.getState().toggleFocus(); return; }
      if (!useStore.getState().project) return;
      const keys = eventToKeys(e);
      if (!keys) return;
      const target = e.target as HTMLElement;
      const typing = target.closest("input, textarea, select") !== null;
      // Dans un champ de saisie, seules les combinaisons avec Ctrl/Alt ou les touches F sont prises en compte.
      if (typing && !/^(Ctrl|Alt)\+|^F\d+$/.test(keys)) return;
      const cmd = findCommand(keys);
      if (!cmd) return;
      e.preventDefault();
      e.stopPropagation();
      void cmd.run();
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, []);

  // Sauvegarde automatique programmée
  useEffect(() => startBackupScheduler(), []);

  // Recherche de mise à jour au démarrage (application de bureau)
  useEffect(() => {
    if (isDesktop && autoUpdateEnabled()) void checkForUpdate();
  }, []);

  if (!project) return (<><Welcome />{toast && <div className="toast">{toast}</div>}</>);

  return (
    <div className={`app ${focus ? "focus" : ""}`}>
      {!focus && (
        <header className="topbar">
          <b className="book-title" title={project.author}>🪶 {project.title}</b>
          <nav className="views">
            {VIEWS.map((x) => (
              <button key={x.v} className={view === x.v ? "active" : ""} onClick={() => setView(x.v)} title={x.tip}>{x.label}</button>
            ))}
          </nav>
          <div className="spacer" />
          <button onClick={() => setModal("palette")} title="Palette de commandes (Ctrl+K)">⌘ Commandes</button>
          <button onClick={() => setModal("search")} title="Ctrl+Maj+F">🔍</button>
          <button onClick={() => setModal("import")} title="Importer .docx / .md">📥 Importer</button>
          <button onClick={() => setModal("export")} title="Ctrl+E">📤 Exporter</button>
          <button onClick={s.toggleFocus} title="F11 — Échap pour quitter">🎯</button>
          <button onClick={() => setModal("settings")} title="Réglages (Ctrl+,)">⚙</button>
          <button
            onClick={async () => {
              await flushEditor();
              if (loadBackup().enabled) await runBackup(false);
              s.closeProject();
            }}
            title="Fermer le projet"
          >✕</button>
        </header>
      )}
      <div className="body">
        {!focus && s.showBinder && <Binder />}
        <main>
          {view === "editor" && <EditorArea />}
          {view === "corkboard" && <Corkboard />}
          {view === "outline" && <Outline />}
          {view === "timeline" && <Timeline />}
          {view === "matrix" && <Matrix />}
          {view === "relations" && <Relations />}
          {view === "stats" && <Stats />}
        </main>
        {!focus && s.showInspector && <Inspector />}
      </div>
      {!focus && <StatusBar />}
      {modal === "export" && <ExportDialog onClose={() => setModal(null)} />}
      {modal === "search" && <SearchDialog onClose={() => setModal(null)} />}
      {modal === "palette" && <Palette mode="palette" />}
      {modal === "quickopen" && <Palette mode="quickopen" />}
      {modal === "settings" && <SettingsDialog />}
      {modal === "import" && <ImportDialog />}
      {modal === "templates" && <TemplatesDialog />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

void COMMANDS;
