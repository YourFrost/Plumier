import { useMemo, useState } from "react";
import { useStore } from "../store";
import { storage } from "../storage";
import { fileToMarkdown, headingCounts, markdownToTree, suggestLevel, type ImportFile } from "../importers";
import { flatten, newNode } from "../tree";
import type { Section, TreeNode } from "../types";

interface Loaded { name: string; md: string; counts: Record<number, number>; level: number }

export function ImportDialog() {
  const { dir, project, setModal, setToast, replaceTrees, setView, select } = useStore();
  const [files, setFiles] = useState<Loaded[]>([]);
  const [section, setSection] = useState<Section>("manuscript");
  const [wrap, setWrap] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  const wrapFolders = wrap ?? files.length > 1;
  const total = useMemo(() => files.reduce((n, f) => n + (f.level === 0 ? 1 : markdownToTree(f.md, f.level, f.name).bodies.size), 0), [files]);

  const pick = async () => {
    setBusy(true);
    try {
      const picked: ImportFile[] = await storage.pickImportFiles();
      const loaded: Loaded[] = [];
      for (const f of picked) {
        const md = await fileToMarkdown(f);
        const counts = headingCounts(md);
        loaded.push({ name: f.name.replace(/\.[^.]+$/, ""), md, counts, level: suggestLevel(counts) });
      }
      setFiles(loaded);
    } catch (e) {
      setToast("Lecture impossible : " + String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!dir || !project) return;
    setBusy(true);
    try {
      const created: TreeNode[] = [];
      let scenes = 0;
      for (const f of files) {
        const { nodes, bodies } = markdownToTree(f.md, f.level, f.name);
        for (const [id, body] of bodies) await storage.writeDoc(dir, id, body);
        scenes += bodies.size;
        if (wrapFolders) {
          const folder = newNode("folder", f.name);
          folder.children = nodes;
          created.push(folder);
        } else created.push(...nodes);
      }
      replaceTrees({ [section]: [...project[section], ...created] } as Record<Section, TreeNode[]>);
      const firstDoc = flatten(created).find((n) => n.kind === "doc");
      setModal(null);
      if (firstDoc) { setView("editor"); select(firstDoc.id); }
      setToast(`Import terminé : ${scenes} ${section === "notes" ? "fiche" : "scène"}${scenes > 1 ? "s" : ""} créée${scenes > 1 ? "s" : ""}.`);
    } catch (e) {
      setToast("Échec de l'import : " + String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={() => setModal(null)}>
      <div className="modal import" onClick={(e) => e.stopPropagation()}>
        <h2>Importer des documents</h2>
        <p className="muted">Fichiers Word (.docx), Markdown (.md) ou texte. Les titres servent à découper automatiquement le texte en dossiers et en scènes ; les notes de bas de page Word sont conservées.</p>
        <button onClick={pick} disabled={busy}>📂 Choisir des fichiers…</button>

        {files.map((f, i) => {
          const levels = [1, 2, 3, 4].filter((l) => f.counts[l]);
          return (
            <div key={i} className="imp-file">
              <b>{f.name}</b>
              <small>{f.md.split(/\s+/).filter(Boolean).length.toLocaleString("fr-FR")} mots · titres : {levels.length ? levels.map((l) => `${f.counts[l]}× niveau ${l}`).join(", ") : "aucun"}</small>
              <label>Découpage
                <select value={f.level} onChange={(e) => setFiles(files.map((x, j) => (j === i ? { ...x, level: +e.target.value } : x)))}>
                  <option value={0}>Un seul document</option>
                  {[1, 2, 3].map((l) => <option key={l} value={l}>Une scène par titre de niveau {l}{f.counts[l] ? ` (${f.counts[l]})` : ""}</option>)}
                </select>
              </label>
            </div>
          );
        })}

        {files.length > 0 && (
          <>
            <label>Destination
              <select value={section} onChange={(e) => setSection(e.target.value as Section)}>
                <option value="manuscript">Manuscrit</option>
                <option value="notes">Fiches (personnages, lieux, notes…)</option>
              </select>
            </label>
            <label className="check"><input type="checkbox" checked={wrapFolders} onChange={(e) => setWrap(e.target.checked)} /> Un dossier par fichier</label>
          </>
        )}
        <div className="modal-actions">
          <button onClick={() => setModal(null)}>Annuler</button>
          <button className="primary" disabled={!files.length || busy} onClick={run}>Importer{files.length ? ` (${total} élément${total > 1 ? "s" : ""})` : ""}</button>
        </div>
      </div>
    </div>
  );
}
