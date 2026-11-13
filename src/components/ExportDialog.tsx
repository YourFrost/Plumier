import { useState } from "react";
import { useStore } from "../store";
import { storage, isDesktop, type ExportFormat } from "../storage";
import { compileManuscript, type CompileOptions } from "../compile";
import { flushEditor } from "./Editor";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "docx", label: "Word (.docx)" },
  { value: "epub", label: "Livre numérique (.epub)" },
  { value: "odt", label: "LibreOffice (.odt)" },
  { value: "html", label: "Page web (.html)" },
  { value: "md", label: "Markdown (.md)" },
];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const { project, dir, setToast } = useStore();
  const [fmt, setFmt] = useState<ExportFormat>("docx");
  const [opt, setOpt] = useState<CompileOptions>({ sceneTitles: false, separator: "* * *", skipIdeas: true });
  const [busy, setBusy] = useState(false);
  if (!project || !dir) return null;

  const run = async () => {
    setBusy(true);
    try {
      await flushEditor();
      const md = await compileManuscript(dir, project.manuscript, opt);
      const out = await storage.exportBook(dir, md, project.title, project.author, fmt);
      if (out) {
        setToast("Exporté : " + out);
        onClose();
      }
    } catch (e) {
      setToast("Échec de l'export : " + String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Exporter le livre</h2>
        <label>Format</label>
        <select value={fmt} onChange={(e) => setFmt(e.target.value as ExportFormat)}>
          {FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={opt.sceneTitles} onChange={(e) => setOpt({ ...opt, sceneTitles: e.target.checked })} /> Afficher les titres des scènes</label>
        <label className="check"><input type="checkbox" checked={opt.skipIdeas} onChange={(e) => setOpt({ ...opt, skipIdeas: e.target.checked })} /> Ignorer les éléments au statut « Idée »</label>
        {!opt.sceneTitles && (
          <>
            <label>Séparateur entre scènes</label>
            <input value={opt.separator} onChange={(e) => setOpt({ ...opt, separator: e.target.value })} />
          </>
        )}
        {fmt !== "md" && isDesktop && <p className="muted">Nécessite <b>Pandoc</b> installé sur le PC (pandoc.org).</p>}
        {!isDesktop && <p className="muted">Version navigateur : seul l'export Markdown est disponible.</p>}
        <div className="modal-actions">
          <button onClick={onClose}>Annuler</button>
          <button className="primary" disabled={busy} onClick={run}>{busy ? "Export…" : "Exporter…"}</button>
        </div>
      </div>
    </div>
  );
}
