import { useEffect, useState } from "react";
import { useStore, type View } from "./store";
import { Binder } from "./components/Binder";
import { Editor } from "./components/Editor";
import { Corkboard } from "./components/Corkboard";
import { Outline } from "./components/Outline";
import { Timeline } from "./components/Timeline";
import { Stats } from "./components/Stats";
import { Inspector } from "./components/Inspector";
import { Welcome } from "./components/Welcome";
import { ExportDialog } from "./components/ExportDialog";
import { SearchDialog } from "./components/SearchDialog";
import { flushEditor } from "./components/Editor";

const VIEWS: { v: View; label: string }[] = [
  { v: "editor", label: "✍ Écriture" },
  { v: "corkboard", label: "🗂 Tableau" },
  { v: "outline", label: "☰ Plan" },
  { v: "timeline", label: "⏱ Chronologie" },
  { v: "stats", label: "📊 Stats" },
];

export function App() {
  const { project, view, setView, focus, toggleFocus, dark, toggleDark, toast, setToast, saveState, closeProject } = useStore();
  const [showExport, setShowExport] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast, setToast]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); setShowSearch(true); }
      if (e.key === "Escape" && useStore.getState().focus) useStore.getState().toggleFocus();
      if (e.key === "F11") { e.preventDefault(); useStore.getState().toggleFocus(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  if (!project) return (<><Welcome />{toast && <div className="toast">{toast}</div>}</>);

  const saveLabel = saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "⚠ Erreur" : "✓ Enregistré";

  return (
    <div className={`app ${focus ? "focus" : ""}`}>
      {!focus && (
        <header className="topbar">
          <b className="book-title" title={project.author}>🪶 {project.title}</b>
          <nav className="views">
            {VIEWS.map((x) => (
              <button key={x.v} className={view === x.v ? "active" : ""} onClick={() => setView(x.v)}>{x.label}</button>
            ))}
          </nav>
          <div className="spacer" />
          <span className={`save ${saveState}`}>{saveLabel}</span>
          <button onClick={() => setShowSearch(true)} title="Ctrl+Maj+F">🔍 Rechercher</button>
          <button onClick={() => setShowExport(true)}>📤 Exporter</button>
          <button onClick={toggleFocus} title="F11 — Échap pour quitter">🎯 Focus</button>
          <button onClick={toggleDark} title="Thème">{dark ? "☀" : "🌙"}</button>
          <button onClick={async () => { await flushEditor(); closeProject(); }} title="Fermer le projet">✕</button>
        </header>
      )}
      <div className="body">
        {!focus && <Binder />}
        <main>
          {view === "editor" && <Editor />}
          {view === "corkboard" && <Corkboard />}
          {view === "outline" && <Outline />}
          {view === "timeline" && <Timeline />}
          {view === "stats" && <Stats />}
        </main>
        {!focus && <Inspector />}
      </div>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
      {showSearch && <SearchDialog onClose={() => setShowSearch(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
